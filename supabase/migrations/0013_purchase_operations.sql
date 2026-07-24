-- Atomic purchase preview and confirmation. The client never supplies stamps as authority.

create or replace function app.preview_purchase(
  target_customer_id uuid,
  target_branch_id uuid,
  target_amount_minor bigint
)
returns table (
  result text,
  stamps_awarded integer,
  remainder_after_minor bigint,
  current_balance integer,
  projected_balance integer,
  program_version integer
)
language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_tenant_id uuid;
  customer_tenant_id uuid;
  program_record record;
  balance_record record;
  calculated_stamps integer;
  calculated_remainder bigint;
  projected integer;
begin
  select sp.tenant_id into staff_tenant_id
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid() and sp.status = 'ACTIVE' and t.status = 'ACTIVE';
  select c.tenant_id into customer_tenant_id from public.customers c
  where c.id = target_customer_id and c.status = 'ACTIVE';

  if staff_tenant_id is null or customer_tenant_id is distinct from staff_tenant_id
    or target_amount_minor is null or target_amount_minor <= 0
    or not exists (select 1 from public.branches b where b.id = target_branch_id and b.tenant_id = staff_tenant_id and b.status = 'ACTIVE')
    or not app.current_staff_can_access_branch(target_branch_id) then
    return query select 'UNAVAILABLE', 0, 0::bigint, 0, 0, 0;
    return;
  end if;

  select * into program_record from public.loyalty_programs
  where tenant_id = staff_tenant_id and status = 'ACTIVE';
  if not found then
    return query select 'PROGRAM_PAUSED', 0, 0::bigint, 0, 0, 0;
    return;
  end if;

  select coalesce(clb.stamp_balance, 0) as stamp_balance,
         coalesce(clb.remainder_minor, 0) as remainder_minor
    into balance_record
  from public.customer_loyalty_balances clb
  where clb.customer_id = target_customer_id;

  if program_record.rule_type = 'PER_PURCHASE' then
    calculated_stamps := case when target_amount_minor >= program_record.minimum_purchase_minor
      then program_record.stamps_per_purchase else 0 end;
    calculated_remainder := coalesce(balance_record.remainder_minor, 0);
  else
    calculated_stamps := floor((target_amount_minor + case when program_record.carry_remainder then coalesce(balance_record.remainder_minor, 0) else 0 end) / program_record.amount_per_stamp_minor)::integer;
    calculated_remainder := case when program_record.carry_remainder
      then (target_amount_minor + coalesce(balance_record.remainder_minor, 0)) % program_record.amount_per_stamp_minor
      else target_amount_minor % program_record.amount_per_stamp_minor end;
  end if;
  projected := coalesce(balance_record.stamp_balance, 0) + calculated_stamps;
  return query select 'PREVIEW'::text, calculated_stamps, calculated_remainder,
    coalesce(balance_record.stamp_balance, 0), projected % program_record.reward_stamp_goal,
    program_record.version;
end;
$$;

create or replace function app.confirm_purchase(
  target_customer_id uuid,
  target_branch_id uuid,
  target_ticket_number text,
  target_amount_minor bigint,
  target_latitude numeric,
  target_longitude numeric
)
returns table (result text, purchase_id uuid, stamps_awarded integer, rewards_generated integer, remainder_after_minor bigint)
language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  customer_record record;
  branch_record record;
  program_record record;
  balance_record record;
  calculated_stamps integer;
  calculated_remainder bigint;
  projected_stamps integer;
  generated_rewards integer := 0;
  purchase_id_value uuid;
  reward_index integer;
begin
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid() and sp.status = 'ACTIVE' and t.status = 'ACTIVE';
  select c.id, c.tenant_id, c.status into customer_record from public.customers c where c.id = target_customer_id;
  select b.id, b.tenant_id into branch_record from public.branches b where b.id = target_branch_id and b.status = 'ACTIVE';

  if not found or staff_record.id is null or customer_record.status <> 'ACTIVE'
    or customer_record.tenant_id is distinct from staff_record.tenant_id
    or branch_record.tenant_id is distinct from staff_record.tenant_id
    or not app.current_staff_can_access_branch(target_branch_id)
    or nullif(btrim(target_ticket_number), '') is null or target_amount_minor is null or target_amount_minor <= 0 then
    return query select 'UNAVAILABLE', null::uuid, 0, 0, 0::bigint;
    return;
  end if;

  if exists (select 1 from public.purchases p where p.branch_id = target_branch_id and p.ticket_number = btrim(target_ticket_number)) then
    return query select 'DUPLICATE_TICKET', null::uuid, 0, 0, 0::bigint;
    return;
  end if;
  select * into program_record from public.loyalty_programs where tenant_id = staff_record.tenant_id and status = 'ACTIVE';
  if not found then
    return query select 'PROGRAM_PAUSED', null::uuid, 0, 0, 0::bigint;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('swiftwallet:customer-balance:' || target_customer_id::text, 0));
  select * into balance_record from public.customer_loyalty_balances where customer_id = target_customer_id for update;
  if not found then
    insert into public.customer_loyalty_balances (tenant_id, customer_id) values (staff_record.tenant_id, target_customer_id);
    select * into balance_record from public.customer_loyalty_balances where customer_id = target_customer_id for update;
  end if;

  if program_record.rule_type = 'PER_PURCHASE' then
    calculated_stamps := case when target_amount_minor >= program_record.minimum_purchase_minor then program_record.stamps_per_purchase else 0 end;
    calculated_remainder := balance_record.remainder_minor;
  else
    calculated_stamps := floor((target_amount_minor + case when program_record.carry_remainder then balance_record.remainder_minor else 0 end) / program_record.amount_per_stamp_minor)::integer;
    calculated_remainder := case when program_record.carry_remainder then (target_amount_minor + balance_record.remainder_minor) % program_record.amount_per_stamp_minor else target_amount_minor % program_record.amount_per_stamp_minor end;
  end if;
  projected_stamps := balance_record.stamp_balance + calculated_stamps;
  generated_rewards := floor(projected_stamps / program_record.reward_stamp_goal)::integer;

  insert into public.purchases (tenant_id, customer_id, branch_id, staff_profile_id, ticket_number, amount_minor, latitude, longitude, rule_type, program_version, stamps_awarded, remainder_before_minor, remainder_after_minor)
  values (staff_record.tenant_id, target_customer_id, target_branch_id, staff_record.id, btrim(target_ticket_number), target_amount_minor, target_latitude, target_longitude, program_record.rule_type, program_record.version, calculated_stamps, balance_record.remainder_minor, calculated_remainder)
  returning id into purchase_id_value;

  update public.customer_loyalty_balances set stamp_balance = projected_stamps % program_record.reward_stamp_goal, remainder_minor = calculated_remainder, updated_at = now() where customer_id = target_customer_id;
  insert into public.stamp_ledger (tenant_id, customer_id, entry_type, purchase_id, stamps_delta, balance_after, remainder_after_minor, created_by_staff_id)
  values (staff_record.tenant_id, target_customer_id, 'PURCHASE', purchase_id_value, calculated_stamps, projected_stamps % program_record.reward_stamp_goal, calculated_remainder, staff_record.id);

  if generated_rewards > 0 then
    for reward_index in 1..generated_rewards loop
      insert into public.rewards (tenant_id, customer_id, program_id, source_purchase_id, name, description, expires_at)
      values (staff_record.tenant_id, target_customer_id, program_record.id, purchase_id_value, program_record.reward_name, program_record.reward_description,
        case when program_record.reward_expiration_days is null then null else now() + make_interval(days => program_record.reward_expiration_days) end);
    end loop;
  end if;
  return query select 'CONFIRMED', purchase_id_value, calculated_stamps, generated_rewards, calculated_remainder;
exception when unique_violation then
  return query select 'DUPLICATE_TICKET', null::uuid, 0, 0, 0::bigint;
end;
$$;

revoke all on function app.preview_purchase(uuid, uuid, bigint), app.confirm_purchase(uuid, uuid, text, bigint, numeric, numeric) from public, anon;
grant execute on function app.preview_purchase(uuid, uuid, bigint), app.confirm_purchase(uuid, uuid, text, bigint, numeric, numeric) to authenticated;
