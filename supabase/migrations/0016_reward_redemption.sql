create table public.reward_redemptions (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  reward_id uuid not null unique references public.rewards(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete restrict,
  redeemed_at timestamptz not null default now(),
  latitude numeric(9, 6),
  longitude numeric(9, 6)
);

create index reward_redemptions_customer_created_idx on public.reward_redemptions (customer_id, redeemed_at desc);

create or replace function app.redeem_reward(
  target_reward_id uuid,
  target_branch_id uuid,
  target_latitude numeric,
  target_longitude numeric
)
returns table (result text, redemption_id uuid)
language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  reward_record record;
  branch_record record;
  redemption_id_value uuid;
begin
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid() and sp.status = 'ACTIVE' and t.status = 'ACTIVE';
  select b.id, b.tenant_id into branch_record from public.branches b where b.id = target_branch_id and b.status = 'ACTIVE';
  select r.id, r.tenant_id, r.customer_id, r.status into reward_record
  from public.rewards r where r.id = target_reward_id for update;

  if staff_record.id is null or branch_record.tenant_id is distinct from staff_record.tenant_id
    or reward_record.tenant_id is distinct from staff_record.tenant_id
    or reward_record.status <> 'AVAILABLE'
    or not app.current_staff_can_access_branch(target_branch_id) then
    return query select 'UNAVAILABLE', null::uuid;
    return;
  end if;

  insert into public.reward_redemptions (tenant_id, reward_id, customer_id, branch_id, staff_profile_id, latitude, longitude)
  values (staff_record.tenant_id, reward_record.id, reward_record.customer_id, target_branch_id, staff_record.id, target_latitude, target_longitude)
  returning id into redemption_id_value;
  update public.rewards set status = 'REDEEMED', redeemed_at = now() where id = reward_record.id;
  return query select 'REDEEMED', redemption_id_value;
exception when unique_violation then
  return query select 'UNAVAILABLE', null::uuid;
end;
$$;

revoke all on function app.redeem_reward(uuid, uuid, numeric, numeric) from public, anon;
grant execute on function app.redeem_reward(uuid, uuid, numeric, numeric) to authenticated;

alter table public.reward_redemptions enable row level security;
alter table public.reward_redemptions force row level security;
create policy reward_redemptions_staff_access on public.reward_redemptions for select to authenticated
  using (app.current_staff_can_access_branch(branch_id));
revoke all on public.reward_redemptions from anon;
grant select on public.reward_redemptions to authenticated;
