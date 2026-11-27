-- Enforce the configurable correction options of each program in the
-- database (DEC-0074). `loyalty_programs` already stores
-- allow_purchase_cancellations, allow_reward_cancellations and
-- allow_redemption_reversals; 0049 enforced only purchase cancellations (and
-- reward cancellations for lifetime points). The admin customer workspace now
-- exposes these corrections, so the backend must refuse disabled ones even
-- if another path calls the RPCs directly.
--
-- * Manual reward cancellation: app.cancel_reward returns 'DISABLED' when the
--   program does not allow it. Rewards cancelled as part of a purchase
--   cancellation keep following allow_purchase_cancellations (they never go
--   through app.cancel_reward).
-- * Redemption reversal: a trigger refuses COMPLETED -> REVERSED when the
--   program of the redeemed reward does not allow it; the RPC call fails.

create or replace function app.cancel_reward(
  target_reward_id uuid,
  target_reason text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  reward_record record;
begin
  if nullif(btrim(target_reason), '') is null then
    return 'INVALID';
  end if;

  select sp.id, sp.tenant_id
    into staff_record
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
    and sp.status = 'ACTIVE'
    and t.status = 'ACTIVE'
    and sp.role = 'ADMIN';

  select *
    into reward_record
  from public.rewards
  where id = target_reward_id
  for update;

  if staff_record.id is null
    or reward_record.id is null
    or reward_record.tenant_id is distinct from staff_record.tenant_id
    or reward_record.status <> 'AVAILABLE' then
    return 'UNAVAILABLE';
  end if;

  if exists (
    select 1 from public.loyalty_programs program
    where program.id = reward_record.program_id
      and not program.allow_reward_cancellations
  ) then
    return 'DISABLED';
  end if;

  if reward_record.expires_at is not null and reward_record.expires_at <= now() then
    update public.rewards
    set status = 'EXPIRED'
    where id = target_reward_id;
    return 'EXPIRED';
  end if;

  update public.rewards
  set status = 'CANCELLED',
      cancelled_at = now(),
      cancelled_by_staff_id = staff_record.id,
      cancellation_reason = btrim(target_reason)
  where id = target_reward_id;

  return 'CANCELLED';
end;
$$;

revoke all on function app.cancel_reward(uuid, text) from public, anon;
grant execute on function app.cancel_reward(uuid, text) to authenticated;

create or replace function app.enforce_redemption_reversal_policy()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth
as $$
begin
  if old.status::text = 'COMPLETED' and new.status::text = 'REVERSED'
    and exists (
      select 1
      from public.rewards reward
      join public.loyalty_programs program on program.id = reward.program_id
      where reward.id = new.reward_id
        and not program.allow_redemption_reversals
    ) then
    raise check_violation using message = 'Redemption reversal is disabled for this program';
  end if;
  return new;
end;
$$;

revoke all on function app.enforce_redemption_reversal_policy() from public, anon, authenticated;

create trigger reward_redemptions_enforce_reversal_policy
  before update of status on public.reward_redemptions
  for each row execute function app.enforce_redemption_reversal_policy();
