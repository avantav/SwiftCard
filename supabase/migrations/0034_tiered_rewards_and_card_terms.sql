-- Add cumulative reward tiers and public card terms without changing the
-- online-only, tenant-derived authority boundary.

alter table public.loyalty_programs
  add column terms_and_conditions text not null
    default 'Consulta los términos y condiciones vigentes con el negocio.';

alter table public.loyalty_programs
  add constraint loyalty_programs_terms_length check (
    length(btrim(terms_and_conditions)) between 10 and 4000
  );

create table public.loyalty_reward_tiers (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  program_id uuid not null references public.loyalty_programs(id) on delete restrict,
  stamps_required integer not null,
  name text not null,
  description text not null default '',
  expiration_days integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_reward_tiers_stamps_positive check (
    stamps_required between 1 and 1000000
  ),
  constraint loyalty_reward_tiers_name_length check (
    length(btrim(name)) between 1 and 120
  ),
  constraint loyalty_reward_tiers_description_length check (
    length(description) <= 500
  ),
  constraint loyalty_reward_tiers_expiration_range check (
    expiration_days is null or expiration_days between 1 and 3650
  ),
  constraint loyalty_reward_tiers_program_stamps_unique unique (
    program_id,
    stamps_required
  )
);

insert into public.loyalty_reward_tiers (
  tenant_id,
  program_id,
  stamps_required,
  name,
  description,
  expiration_days
)
select
  lp.tenant_id,
  lp.id,
  lp.reward_stamp_goal,
  lp.reward_name,
  lp.reward_description,
  lp.reward_expiration_days
from public.loyalty_programs lp
on conflict (program_id, stamps_required) do nothing;

alter table public.customer_loyalty_balances
  add column completed_cycles bigint not null default 0,
  add constraint customer_balances_completed_cycles_nonnegative check (
    completed_cycles >= 0
  );

alter table public.rewards
  add column reward_tier_id uuid references public.loyalty_reward_tiers(id) on delete restrict,
  add column reward_cycle bigint,
  add column stamps_required_snapshot integer,
  add column program_version_snapshot integer;

with ranked_rewards as (
  select
    r.id,
    lrt.id as reward_tier_id,
    lp.reward_stamp_goal,
    lp.version,
    row_number() over (
      partition by r.customer_id, r.program_id
      order by r.created_at, r.id
    ) as reward_cycle
  from public.rewards r
  join public.loyalty_programs lp on lp.id = r.program_id
  join public.loyalty_reward_tiers lrt
    on lrt.program_id = lp.id
    and lrt.stamps_required = lp.reward_stamp_goal
)
update public.rewards r
set reward_tier_id = ranked_rewards.reward_tier_id,
    reward_cycle = ranked_rewards.reward_cycle,
    stamps_required_snapshot = ranked_rewards.reward_stamp_goal,
    program_version_snapshot = ranked_rewards.version
from ranked_rewards
where ranked_rewards.id = r.id;

update public.customer_loyalty_balances clb
set completed_cycles = reward_counts.reward_count
from (
  select r.customer_id, count(*)::bigint as reward_count
  from public.rewards r
  group by r.customer_id
) reward_counts
where reward_counts.customer_id = clb.customer_id;

create unique index rewards_customer_tier_cycle_unique_idx
  on public.rewards (customer_id, reward_tier_id, reward_cycle)
  where reward_tier_id is not null and reward_cycle is not null;

create index loyalty_reward_tiers_program_active_idx
  on public.loyalty_reward_tiers (program_id, stamps_required)
  where active;

alter table public.purchases
  add column reward_cycles_completed integer not null default 0,
  add column reward_cycle_goal integer,
  add constraint purchases_reward_cycles_nonnegative check (
    reward_cycles_completed >= 0
  ),
  add constraint purchases_reward_cycle_goal_positive check (
    reward_cycle_goal is null or reward_cycle_goal > 0
  );

with purchase_reward_counts as (
  select
    r.source_purchase_id as purchase_id,
    count(*)::integer as reward_count,
    max(lp.reward_stamp_goal) as reward_goal
  from public.rewards r
  join public.loyalty_programs lp on lp.id = r.program_id
  where r.source_purchase_id is not null
  group by r.source_purchase_id
)
update public.purchases p
set reward_cycles_completed = purchase_reward_counts.reward_count,
    reward_cycle_goal = purchase_reward_counts.reward_goal
from purchase_reward_counts
where purchase_reward_counts.purchase_id = p.id;

alter table public.stamp_adjustments
  add column reward_cycles_completed integer not null default 0,
  add column reward_cycle_goal integer,
  add constraint stamp_adjustments_reward_cycles_nonnegative check (
    reward_cycles_completed >= 0
  ),
  add constraint stamp_adjustments_reward_cycle_goal_positive check (
    reward_cycle_goal is null or reward_cycle_goal > 0
  );

with adjustment_reward_counts as (
  select
    r.source_adjustment_id as adjustment_id,
    count(*)::integer as reward_count,
    max(lp.reward_stamp_goal) as reward_goal
  from public.rewards r
  join public.loyalty_programs lp on lp.id = r.program_id
  where r.source_adjustment_id is not null
  group by r.source_adjustment_id
)
update public.stamp_adjustments sa
set reward_cycles_completed = adjustment_reward_counts.reward_count,
    reward_cycle_goal = adjustment_reward_counts.reward_goal
from adjustment_reward_counts
where adjustment_reward_counts.adjustment_id = sa.id;

create or replace function app.enforce_reward_tier_tenant_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  program_tenant_id uuid;
begin
  select lp.tenant_id
    into program_tenant_id
  from public.loyalty_programs lp
  where lp.id = new.program_id;

  if program_tenant_id is distinct from new.tenant_id then
    raise exception 'reward tier tenant must match program'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger loyalty_reward_tiers_enforce_tenant
  before insert or update on public.loyalty_reward_tiers
  for each row execute function app.enforce_reward_tier_tenant_consistency();

create or replace function app.enforce_reward_tier_reference()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  if new.reward_tier_id is not null and not exists (
    select 1
    from public.loyalty_reward_tiers lrt
    where lrt.id = new.reward_tier_id
      and lrt.program_id = new.program_id
      and lrt.tenant_id = new.tenant_id
  ) then
    raise exception 'reward tier must match reward program and tenant'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger rewards_enforce_tier_reference
  before insert or update on public.rewards
  for each row execute function app.enforce_reward_tier_reference();

alter table public.loyalty_reward_tiers enable row level security;
alter table public.loyalty_reward_tiers force row level security;

create policy loyalty_reward_tiers_staff_read
  on public.loyalty_reward_tiers
  for select
  to authenticated
  using (app.current_staff_can_manage_tenant(tenant_id) or app.is_superadmin());

revoke all on public.loyalty_reward_tiers from anon, authenticated;
grant select on public.loyalty_reward_tiers to authenticated;

create or replace function app.ensure_default_reward_tier()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  insert into public.loyalty_reward_tiers (
    tenant_id,
    program_id,
    stamps_required,
    name,
    description,
    expiration_days
  )
  values (
    new.tenant_id,
    new.id,
    new.reward_stamp_goal,
    new.reward_name,
    new.reward_description,
    new.reward_expiration_days
  )
  on conflict (program_id, stamps_required) do update
  set name = excluded.name,
      description = excluded.description,
      expiration_days = excluded.expiration_days,
      active = true,
      updated_at = now();

  return new;
end;
$$;

create trigger loyalty_programs_default_reward_tier
  after insert on public.loyalty_programs
  for each row execute function app.ensure_default_reward_tier();

create or replace function app.reward_tiers_are_valid(target_reward_tiers jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  tier_count integer;
  distinct_stamps integer;
  invalid_count integer;
begin
  if jsonb_typeof(target_reward_tiers) <> 'array' then
    return false;
  end if;

  tier_count := jsonb_array_length(target_reward_tiers);
  if tier_count not between 1 and 10 then
    return false;
  end if;

  select
    count(distinct tier.stamps_required),
    count(*) filter (
      where tier.stamps_required not between 1 and 1000000
        or coalesce(length(btrim(tier.name)), 0) not between 1 and 120
        or tier.description is null
        or length(tier.description) > 500
        or (
          tier.expiration_days is not null
          and tier.expiration_days not between 1 and 3650
        )
    )
    into distinct_stamps, invalid_count
  from jsonb_to_recordset(target_reward_tiers) as tier(
    stamps_required integer,
    name text,
    description text,
    expiration_days integer
  );

  return distinct_stamps = tier_count and invalid_count = 0;
exception
  when others then
    return false;
end;
$$;

create or replace function app.replace_reward_tiers(
  target_program_id uuid,
  target_tenant_id uuid,
  target_reward_tiers jsonb
)
returns void
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  if not app.reward_tiers_are_valid(target_reward_tiers) then
    raise exception 'invalid reward tiers' using errcode = '23514';
  end if;

  update public.loyalty_reward_tiers
  set active = false,
      updated_at = now()
  where program_id = target_program_id;

  insert into public.loyalty_reward_tiers (
    tenant_id,
    program_id,
    stamps_required,
    name,
    description,
    expiration_days,
    active
  )
  select
    target_tenant_id,
    target_program_id,
    tier.stamps_required,
    btrim(tier.name),
    btrim(tier.description),
    tier.expiration_days,
    true
  from jsonb_to_recordset(target_reward_tiers) as tier(
    stamps_required integer,
    name text,
    description text,
    expiration_days integer
  )
  on conflict (program_id, stamps_required) do update
  set name = excluded.name,
      description = excluded.description,
      expiration_days = excluded.expiration_days,
      active = true,
      updated_at = now();
end;
$$;

create or replace function app.apply_reward_tiers(
  target_customer_id uuid,
  target_program_id uuid,
  target_starting_balance integer,
  target_stamps_added integer,
  target_source_purchase_id uuid,
  target_source_adjustment_id uuid
)
returns table (
  final_balance integer,
  rewards_generated integer,
  cycles_completed integer
)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  balance_record record;
  program_record record;
  tier_record record;
  projected_balance bigint;
  reward_starting_balance integer;
  cycle_index integer;
  threshold_value bigint;
  inserted_count integer;
  generated_count integer := 0;
  completed_count integer;
begin
  if target_starting_balance < 0
    or target_stamps_added < 0
    or num_nonnulls(target_source_purchase_id, target_source_adjustment_id) > 1 then
    raise exception 'invalid reward tier application' using errcode = '23514';
  end if;

  select clb.*
    into balance_record
  from public.customer_loyalty_balances clb
  where clb.customer_id = target_customer_id
  for update;

  select lp.*
    into program_record
  from public.loyalty_programs lp
  where lp.id = target_program_id;

  if balance_record.id is null
    or program_record.id is null
    or balance_record.tenant_id is distinct from program_record.tenant_id
    or not exists (
      select 1
      from public.loyalty_reward_tiers lrt
      where lrt.program_id = target_program_id
        and lrt.active
        and lrt.stamps_required = program_record.reward_stamp_goal
    ) then
    raise exception 'reward tier configuration unavailable' using errcode = '23514';
  end if;

  projected_balance := target_starting_balance::bigint + target_stamps_added::bigint;
  reward_starting_balance := case
    when target_starting_balance >= program_record.reward_stamp_goal then 0
    else target_starting_balance
  end;
  completed_count := floor(
    projected_balance::numeric / program_record.reward_stamp_goal
  )::integer;

  for tier_record in
    select lrt.*
    from public.loyalty_reward_tiers lrt
    where lrt.program_id = target_program_id
      and lrt.active
    order by lrt.stamps_required, lrt.id
  loop
    for cycle_index in 0..completed_count loop
      threshold_value :=
        cycle_index::bigint * program_record.reward_stamp_goal
        + tier_record.stamps_required;

      if threshold_value > reward_starting_balance
        and threshold_value <= projected_balance then
        insert into public.rewards (
          tenant_id,
          customer_id,
          program_id,
          source_purchase_id,
          source_adjustment_id,
          reward_tier_id,
          reward_cycle,
          stamps_required_snapshot,
          program_version_snapshot,
          name,
          description,
          expires_at
        )
        values (
          program_record.tenant_id,
          target_customer_id,
          target_program_id,
          target_source_purchase_id,
          target_source_adjustment_id,
          tier_record.id,
          balance_record.completed_cycles + cycle_index + 1,
          tier_record.stamps_required,
          program_record.version,
          tier_record.name,
          tier_record.description,
          case
            when tier_record.expiration_days is null then null
            else now() + make_interval(days => tier_record.expiration_days)
          end
        )
        on conflict (customer_id, reward_tier_id, reward_cycle)
          where reward_tier_id is not null and reward_cycle is not null
          do nothing;

        get diagnostics inserted_count = row_count;
        generated_count := generated_count + inserted_count;
      end if;
    end loop;
  end loop;

  update public.customer_loyalty_balances
  set stamp_balance = (projected_balance % program_record.reward_stamp_goal)::integer,
      completed_cycles = completed_cycles + completed_count,
      updated_at = now()
  where customer_id = target_customer_id;

  return query
  select
    (projected_balance % program_record.reward_stamp_goal)::integer,
    generated_count,
    completed_count;
end;
$$;

create or replace function app.save_loyalty_program_with_tiers(
  target_program_id uuid,
  target_name text,
  target_status public.loyalty_program_status,
  target_rule_type public.loyalty_rule_type,
  target_minimum_purchase_minor bigint,
  target_stamps_per_purchase integer,
  target_amount_per_stamp_minor bigint,
  target_carry_remainder boolean,
  target_terms_and_conditions text,
  target_reward_tiers jsonb
)
returns table (result text, saved_program_id uuid)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  existing_program record;
  top_tier record;
  program_id_value uuid;
  balance_customer_id uuid;
  balance_record record;
  tier_result record;
  result_value text;
begin
  select sp.id, sp.tenant_id
    into staff_record
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
    and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE'
    and t.status = 'ACTIVE';

  if staff_record.id is null or staff_record.tenant_id is null then
    return query select 'UNAVAILABLE', null::uuid;
    return;
  end if;

  if target_status is null
    or target_rule_type is null
    or target_carry_remainder is null
    or coalesce(length(btrim(target_name)), 0) not between 1 and 120
    or coalesce(length(btrim(target_terms_and_conditions)), 0) not between 10 and 4000
    or target_minimum_purchase_minor is null
    or target_minimum_purchase_minor not between 0 and 9007199254740991
    or target_stamps_per_purchase is null
    or target_stamps_per_purchase not between 1 and 1000000
    or not app.reward_tiers_are_valid(target_reward_tiers)
    or not coalesce(
      (
        target_rule_type = 'PER_PURCHASE'
        and target_amount_per_stamp_minor is null
      )
      or (
        target_rule_type = 'PER_AMOUNT'
        and target_minimum_purchase_minor = 0
        and target_stamps_per_purchase = 1
        and target_amount_per_stamp_minor between 1 and 9007199254740991
      ),
      false
    ) then
    return query select 'INVALID', null::uuid;
    return;
  end if;

  select tier.*
    into top_tier
  from jsonb_to_recordset(target_reward_tiers) as tier(
    stamps_required integer,
    name text,
    description text,
    expiration_days integer
  )
  order by tier.stamps_required desc
  limit 1;

  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:tenant-program:' || staff_record.tenant_id::text, 0)
  );

  if target_program_id is null then
    if exists (
      select 1
      from public.loyalty_programs lp
      where lp.tenant_id = staff_record.tenant_id
    ) then
      return query select 'ALREADY_EXISTS', null::uuid;
      return;
    end if;

    insert into public.loyalty_programs (
      tenant_id,
      name,
      status,
      rule_type,
      minimum_purchase_minor,
      stamps_per_purchase,
      amount_per_stamp_minor,
      carry_remainder,
      reward_stamp_goal,
      reward_name,
      reward_description,
      reward_expiration_days,
      terms_and_conditions
    )
    values (
      staff_record.tenant_id,
      btrim(target_name),
      target_status,
      target_rule_type,
      target_minimum_purchase_minor,
      target_stamps_per_purchase,
      target_amount_per_stamp_minor,
      target_carry_remainder,
      top_tier.stamps_required,
      btrim(top_tier.name),
      btrim(top_tier.description),
      top_tier.expiration_days,
      btrim(target_terms_and_conditions)
    )
    returning id into program_id_value;

    result_value := 'CREATED';
  else
    select lp.id, lp.tenant_id
      into existing_program
    from public.loyalty_programs lp
    where lp.id = target_program_id;

    if existing_program.id is null
      or existing_program.tenant_id is distinct from staff_record.tenant_id then
      return query select 'UNAVAILABLE', null::uuid;
      return;
    end if;

    update public.loyalty_programs
    set name = btrim(target_name),
        status = target_status,
        rule_type = target_rule_type,
        minimum_purchase_minor = target_minimum_purchase_minor,
        stamps_per_purchase = target_stamps_per_purchase,
        amount_per_stamp_minor = target_amount_per_stamp_minor,
        carry_remainder = target_carry_remainder,
        reward_stamp_goal = top_tier.stamps_required,
        reward_name = btrim(top_tier.name),
        reward_description = btrim(top_tier.description),
        reward_expiration_days = top_tier.expiration_days,
        terms_and_conditions = btrim(target_terms_and_conditions),
        version = version + 1,
        updated_at = now()
    where id = target_program_id
      and tenant_id = staff_record.tenant_id;

    program_id_value := target_program_id;
    result_value := 'UPDATED';
  end if;

  perform app.replace_reward_tiers(
    program_id_value,
    staff_record.tenant_id,
    target_reward_tiers
  );

  if target_status = 'ACTIVE' then
    for balance_customer_id in
      select clb.customer_id
      from public.customer_loyalty_balances clb
      where clb.tenant_id = staff_record.tenant_id
        and clb.stamp_balance > 0
      order by clb.customer_id
    loop
      perform pg_advisory_xact_lock(
        hashtextextended('swiftwallet:customer-balance:' || balance_customer_id::text, 0)
      );

      select clb.*
        into balance_record
      from public.customer_loyalty_balances clb
      where clb.customer_id = balance_customer_id
      for update;

      select *
        into tier_result
      from app.apply_reward_tiers(
        balance_customer_id,
        program_id_value,
        0,
        balance_record.stamp_balance,
        null,
        null
      );

      if tier_result.rewards_generated > 0
        or tier_result.cycles_completed > 0 then
        insert into public.stamp_ledger (
          tenant_id,
          customer_id,
          entry_type,
          stamps_delta,
          balance_after,
          remainder_after_minor,
          reason,
          created_by_staff_id
        )
        values (
          staff_record.tenant_id,
          balance_customer_id,
          'PROGRAM_CHANGE',
          0,
          tier_result.final_balance,
          balance_record.remainder_minor,
          case
            when result_value = 'CREATED' then 'Conversión por configuración inicial'
            else 'Conversión por niveles de recompensa'
          end,
          staff_record.id
        );
      end if;
    end loop;
  end if;

  insert into public.audit_logs (
    tenant_id,
    actor_staff_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    staff_record.tenant_id,
    staff_record.id,
    'LOYALTY_REWARD_TIERS_CONFIGURED',
    'loyalty_programs',
    program_id_value,
    jsonb_build_object(
      'terms_and_conditions', btrim(target_terms_and_conditions),
      'reward_tiers', target_reward_tiers
    )
  );

  return query select result_value, program_id_value;
exception
  when check_violation
    or not_null_violation
    or unique_violation
    or invalid_text_representation
    or numeric_value_out_of_range then
    return query select 'INVALID', null::uuid;
end;
$$;

create or replace function app.create_loyalty_program(
  target_name text,
  target_status public.loyalty_program_status,
  target_rule_type public.loyalty_rule_type,
  target_minimum_purchase_minor bigint,
  target_stamps_per_purchase integer,
  target_amount_per_stamp_minor bigint,
  target_carry_remainder boolean,
  target_reward_stamp_goal integer,
  target_reward_name text,
  target_reward_description text,
  target_reward_expiration_days integer
)
returns table (result text, program_id uuid)
language sql
security definer
set search_path = public, app, auth, extensions
as $$
  select saved.result, saved.saved_program_id
  from app.save_loyalty_program_with_tiers(
    null,
    target_name,
    target_status,
    target_rule_type,
    target_minimum_purchase_minor,
    target_stamps_per_purchase,
    target_amount_per_stamp_minor,
    target_carry_remainder,
    'Consulta los términos y condiciones vigentes con el negocio.',
    jsonb_build_array(jsonb_build_object(
      'stamps_required', target_reward_stamp_goal,
      'name', target_reward_name,
      'description', target_reward_description,
      'expiration_days', target_reward_expiration_days
    ))
  ) saved;
$$;

create or replace function app.configure_loyalty_program(
  target_program_id uuid,
  target_name text,
  target_status public.loyalty_program_status,
  target_rule_type public.loyalty_rule_type,
  target_minimum_purchase_minor bigint,
  target_stamps_per_purchase integer,
  target_amount_per_stamp_minor bigint,
  target_carry_remainder boolean,
  target_reward_stamp_goal integer,
  target_reward_name text,
  target_reward_description text,
  target_reward_expiration_days integer
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  current_terms text;
  save_result record;
begin
  select lp.terms_and_conditions
    into current_terms
  from public.loyalty_programs lp
  join public.staff_profiles sp
    on sp.id = auth.uid()
    and sp.tenant_id = lp.tenant_id
    and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE'
  join public.tenants t
    on t.id = sp.tenant_id
    and t.status = 'ACTIVE'
  where lp.id = target_program_id;

  if current_terms is null then
    return 'UNAVAILABLE';
  end if;

  select *
    into save_result
  from app.save_loyalty_program_with_tiers(
    target_program_id,
    target_name,
    target_status,
    target_rule_type,
    target_minimum_purchase_minor,
    target_stamps_per_purchase,
    target_amount_per_stamp_minor,
    target_carry_remainder,
    current_terms,
    jsonb_build_array(jsonb_build_object(
      'stamps_required', target_reward_stamp_goal,
      'name', target_reward_name,
      'description', target_reward_description,
      'expiration_days', target_reward_expiration_days
    ))
  );

  return save_result.result;
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
returns table (
  result text,
  purchase_id uuid,
  stamps_awarded integer,
  rewards_generated integer,
  remainder_after_minor bigint
)
language plpgsql
security definer
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
  purchase_id_value uuid;
  tier_result record;
begin
  select sp.id, sp.tenant_id
    into staff_record
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
    and sp.status = 'ACTIVE'
    and t.status = 'ACTIVE';

  select c.id, c.tenant_id, c.status
    into customer_record
  from public.customers c
  where c.id = target_customer_id;

  select b.id, b.tenant_id
    into branch_record
  from public.branches b
  where b.id = target_branch_id
    and b.status = 'ACTIVE';

  if staff_record.id is null
    or customer_record.id is null
    or customer_record.status <> 'ACTIVE'
    or customer_record.tenant_id is distinct from staff_record.tenant_id
    or branch_record.tenant_id is distinct from staff_record.tenant_id
    or not app.current_staff_can_access_branch(target_branch_id)
    or nullif(btrim(target_ticket_number), '') is null
    or target_amount_minor is null
    or target_amount_minor <= 0 then
    return query select 'UNAVAILABLE', null::uuid, 0, 0, 0::bigint;
    return;
  end if;

  if exists (
    select 1
    from public.purchases p
    where p.branch_id = target_branch_id
      and p.ticket_number = btrim(target_ticket_number)
  ) then
    return query select 'DUPLICATE_TICKET', null::uuid, 0, 0, 0::bigint;
    return;
  end if;

  perform pg_advisory_xact_lock_shared(
    hashtextextended('swiftwallet:tenant-program:' || staff_record.tenant_id::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:customer-balance:' || target_customer_id::text, 0)
  );

  select lp.*
    into program_record
  from public.loyalty_programs lp
  where lp.tenant_id = staff_record.tenant_id
    and lp.status = 'ACTIVE';

  if not found then
    return query select 'PROGRAM_PAUSED', null::uuid, 0, 0, 0::bigint;
    return;
  end if;

  select clb.*
    into balance_record
  from public.customer_loyalty_balances clb
  where clb.customer_id = target_customer_id
  for update;

  if not found then
    insert into public.customer_loyalty_balances (tenant_id, customer_id)
    values (staff_record.tenant_id, target_customer_id);

    select clb.*
      into balance_record
    from public.customer_loyalty_balances clb
    where clb.customer_id = target_customer_id
    for update;
  end if;

  if program_record.rule_type = 'PER_PURCHASE' then
    calculated_stamps := case
      when target_amount_minor >= program_record.minimum_purchase_minor
        then program_record.stamps_per_purchase
      else 0
    end;
    calculated_remainder := balance_record.remainder_minor;
  else
    calculated_stamps := floor((
      target_amount_minor
      + case
        when program_record.carry_remainder then balance_record.remainder_minor
        else 0
      end
    ) / program_record.amount_per_stamp_minor)::integer;
    calculated_remainder := case
      when program_record.carry_remainder then
        (target_amount_minor + balance_record.remainder_minor)
          % program_record.amount_per_stamp_minor
      else target_amount_minor % program_record.amount_per_stamp_minor
    end;
  end if;

  insert into public.purchases (
    tenant_id,
    customer_id,
    branch_id,
    staff_profile_id,
    ticket_number,
    amount_minor,
    latitude,
    longitude,
    rule_type,
    program_version,
    stamps_awarded,
    remainder_before_minor,
    remainder_after_minor,
    reward_cycle_goal
  )
  values (
    staff_record.tenant_id,
    target_customer_id,
    target_branch_id,
    staff_record.id,
    btrim(target_ticket_number),
    target_amount_minor,
    target_latitude,
    target_longitude,
    program_record.rule_type,
    program_record.version,
    calculated_stamps,
    balance_record.remainder_minor,
    calculated_remainder,
    program_record.reward_stamp_goal
  )
  returning id into purchase_id_value;

  select *
    into tier_result
  from app.apply_reward_tiers(
    target_customer_id,
    program_record.id,
    balance_record.stamp_balance,
    calculated_stamps,
    purchase_id_value,
    null
  );

  update public.customer_loyalty_balances
  set remainder_minor = calculated_remainder,
      updated_at = now()
  where customer_id = target_customer_id;

  update public.purchases
  set reward_cycles_completed = tier_result.cycles_completed
  where id = purchase_id_value;

  insert into public.stamp_ledger (
    tenant_id,
    customer_id,
    entry_type,
    purchase_id,
    stamps_delta,
    balance_after,
    remainder_after_minor,
    created_by_staff_id
  )
  values (
    staff_record.tenant_id,
    target_customer_id,
    'PURCHASE',
    purchase_id_value,
    calculated_stamps,
    tier_result.final_balance,
    calculated_remainder,
    staff_record.id
  );

  return query
  select
    'CONFIRMED',
    purchase_id_value,
    calculated_stamps,
    tier_result.rewards_generated,
    calculated_remainder;
exception
  when unique_violation then
    return query select 'DUPLICATE_TICKET', null::uuid, 0, 0, 0::bigint;
end;
$$;

create or replace function app.cancel_purchase(
  target_purchase_id uuid,
  target_reason text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  purchase_record record;
  balance_record record;
  previous_balance integer;
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
    and t.status = 'ACTIVE';

  select p.*
    into purchase_record
  from public.purchases p
  where p.id = target_purchase_id
  for update;

  if staff_record.id is null
    or purchase_record.id is null
    or purchase_record.status <> 'CONFIRMED'
    or not (
      app.current_staff_can_manage_tenant(purchase_record.tenant_id)
      or (
        app.current_staff_role() = 'MANAGER'
        and app.current_staff_can_access_branch(purchase_record.branch_id)
      )
    ) then
    return 'UNAVAILABLE';
  end if;

  perform pg_advisory_xact_lock_shared(
    hashtextextended('swiftwallet:tenant-program:' || purchase_record.tenant_id::text, 0)
  );

  if exists (
    select 1
    from public.stamp_ledger sl
    where sl.customer_id = purchase_record.customer_id
      and sl.created_at > purchase_record.created_at
  ) then
    return 'HAS_LATER_ACTIVITY';
  end if;

  if exists (
    select 1
    from public.rewards r
    where r.source_purchase_id = purchase_record.id
      and r.status = 'REDEEMED'
  ) then
    return 'REWARD_ALREADY_REDEEMED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'swiftwallet:customer-balance:' || purchase_record.customer_id::text,
      0
    )
  );

  select clb.*
    into balance_record
  from public.customer_loyalty_balances clb
  where clb.customer_id = purchase_record.customer_id
  for update;

  previous_balance := balance_record.stamp_balance
    - purchase_record.stamps_awarded
    + purchase_record.reward_cycles_completed
      * coalesce(purchase_record.reward_cycle_goal, 0);

  if previous_balance < 0
    or balance_record.completed_cycles < purchase_record.reward_cycles_completed then
    return 'UNAVAILABLE';
  end if;

  update public.customer_loyalty_balances
  set stamp_balance = previous_balance,
      completed_cycles = completed_cycles - purchase_record.reward_cycles_completed,
      remainder_minor = purchase_record.remainder_before_minor,
      updated_at = now()
  where customer_id = purchase_record.customer_id;

  update public.rewards
  set status = 'CANCELLED',
      redeemed_at = null,
      cancelled_at = now(),
      cancelled_by_staff_id = staff_record.id,
      cancellation_reason = btrim(target_reason)
  where source_purchase_id = purchase_record.id
    and status in ('AVAILABLE', 'EXPIRED');

  insert into public.stamp_ledger (
    tenant_id,
    customer_id,
    entry_type,
    purchase_id,
    stamps_delta,
    balance_after,
    remainder_after_minor,
    reason,
    created_by_staff_id
  )
  values (
    purchase_record.tenant_id,
    purchase_record.customer_id,
    'CANCELLATION',
    purchase_record.id,
    -purchase_record.stamps_awarded,
    previous_balance,
    purchase_record.remainder_before_minor,
    btrim(target_reason),
    staff_record.id
  );

  update public.purchases
  set status = 'CANCELLED',
      cancelled_at = now(),
      cancelled_by_staff_id = staff_record.id,
      cancellation_reason = btrim(target_reason)
  where id = purchase_record.id;

  return 'CANCELLED';
end;
$$;

create or replace function app.adjust_customer_stamps(
  target_customer_id uuid,
  target_branch_id uuid,
  target_stamps_delta integer,
  target_reason text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  customer_record record;
  balance_record record;
  program_record record;
  projected_balance integer;
  final_balance integer;
  generated_rewards integer := 0;
  completed_count integer := 0;
  adjustment_id_value uuid;
  tier_result record;
begin
  if target_stamps_delta = 0 or nullif(btrim(target_reason), '') is null then
    return 'INVALID';
  end if;

  select sp.id, sp.tenant_id
    into staff_record
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
    and sp.status = 'ACTIVE'
    and t.status = 'ACTIVE';

  select c.*
    into customer_record
  from public.customers c
  where c.id = target_customer_id
    and c.status = 'ACTIVE';

  if staff_record.id is null
    or customer_record.tenant_id is distinct from staff_record.tenant_id
    or not (
      app.current_staff_can_manage_tenant(customer_record.tenant_id)
      or (
        app.current_staff_role() = 'MANAGER'
        and app.current_staff_can_access_branch(target_branch_id)
      )
    )
    or not exists (
      select 1
      from public.branches b
      where b.id = target_branch_id
        and b.tenant_id = staff_record.tenant_id
        and b.status = 'ACTIVE'
    ) then
    return 'UNAVAILABLE';
  end if;

  perform pg_advisory_xact_lock_shared(
    hashtextextended('swiftwallet:tenant-program:' || staff_record.tenant_id::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:customer-balance:' || target_customer_id::text, 0)
  );

  if target_stamps_delta > 0 then
    select lp.*
      into program_record
    from public.loyalty_programs lp
    where lp.tenant_id = staff_record.tenant_id
      and lp.status = 'ACTIVE';

    if not found then
      return 'PROGRAM_PAUSED';
    end if;
  end if;

  select clb.*
    into balance_record
  from public.customer_loyalty_balances clb
  where clb.customer_id = target_customer_id
  for update;

  if not found then
    insert into public.customer_loyalty_balances (tenant_id, customer_id)
    values (staff_record.tenant_id, target_customer_id);

    select clb.*
      into balance_record
    from public.customer_loyalty_balances clb
    where clb.customer_id = target_customer_id
    for update;
  end if;

  projected_balance := balance_record.stamp_balance + target_stamps_delta;
  if projected_balance < 0 then
    return 'NEGATIVE_BALANCE';
  end if;

  adjustment_id_value := extensions.gen_random_uuid();

  if target_stamps_delta > 0 then
    completed_count := floor(
      projected_balance::numeric / program_record.reward_stamp_goal
    )::integer;

    select count(*)::integer
      into generated_rewards
    from public.loyalty_reward_tiers lrt
    cross join generate_series(0, completed_count) as cycle(cycle_index)
    where lrt.program_id = program_record.id
      and lrt.active
      and (
        cycle.cycle_index::bigint * program_record.reward_stamp_goal
        + lrt.stamps_required
      ) > case
        when balance_record.stamp_balance >= program_record.reward_stamp_goal then 0
        else balance_record.stamp_balance
      end
      and (
        cycle.cycle_index::bigint * program_record.reward_stamp_goal
        + lrt.stamps_required
      ) <= projected_balance;
  end if;

  insert into public.stamp_adjustments (
    id,
    tenant_id,
    customer_id,
    branch_id,
    staff_profile_id,
    stamps_delta,
    rewards_generated,
    reward_cycles_completed,
    reward_cycle_goal,
    reason
  )
  values (
    adjustment_id_value,
    staff_record.tenant_id,
    target_customer_id,
    target_branch_id,
    staff_record.id,
    target_stamps_delta,
    generated_rewards,
    completed_count,
    case when target_stamps_delta > 0 then program_record.reward_stamp_goal else null end,
    btrim(target_reason)
  );

  if target_stamps_delta > 0 then
    select *
      into tier_result
    from app.apply_reward_tiers(
      target_customer_id,
      program_record.id,
      balance_record.stamp_balance,
      target_stamps_delta,
      null,
      adjustment_id_value
    );
    final_balance := tier_result.final_balance;

    update public.stamp_adjustments
    set rewards_generated = tier_result.rewards_generated,
        reward_cycles_completed = tier_result.cycles_completed
    where id = adjustment_id_value;
  else
    final_balance := projected_balance;
    update public.customer_loyalty_balances
    set stamp_balance = final_balance,
        updated_at = now()
    where customer_id = target_customer_id;
  end if;

  insert into public.stamp_ledger (
    tenant_id,
    customer_id,
    entry_type,
    stamps_delta,
    balance_after,
    remainder_after_minor,
    reason,
    created_by_staff_id
  )
  values (
    staff_record.tenant_id,
    target_customer_id,
    'ADJUSTMENT',
    target_stamps_delta,
    final_balance,
    balance_record.remainder_minor,
    btrim(target_reason),
    staff_record.id
  );

  return 'ADJUSTED';
end;
$$;

drop function if exists app.get_public_web_card(text);

create function app.get_public_web_card(target_card_token text)
returns table (
  tenant_name text,
  branding_mode public.branding_mode,
  logo_url text,
  primary_color text,
  secondary_color text,
  customer_name text,
  program_name text,
  program_status text,
  stamp_balance integer,
  reward_goal integer,
  terms_and_conditions text,
  reward_tiers jsonb,
  available_rewards jsonb
)
language sql
security definer
set search_path = public, app, auth
as $$
  select
    t.name,
    t.branding_mode,
    t.logo_url,
    t.primary_color,
    t.secondary_color,
    c.full_name,
    lp.name,
    lp.status::text,
    coalesce(clb.stamp_balance, 0),
    lp.reward_stamp_goal,
    lp.terms_and_conditions,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'stamps_required', lrt.stamps_required,
          'name', lrt.name,
          'description', lrt.description,
          'expiration_days', lrt.expiration_days
        )
        order by lrt.stamps_required, lrt.id
      )
      from public.loyalty_reward_tiers lrt
      where lrt.program_id = lp.id
        and lrt.active
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', r.name,
          'description', r.description,
          'stamps_required', r.stamps_required_snapshot,
          'expires_at', r.expires_at
        )
        order by r.created_at, r.id
      )
      from public.rewards r
      where r.customer_id = c.id
        and r.status = 'AVAILABLE'
        and (r.expires_at is null or r.expires_at > now())
    ), '[]'::jsonb)
  from public.customer_cards cc
  join public.customers c on c.id = cc.customer_id
  join public.tenants t on t.id = cc.tenant_id
  left join public.customer_loyalty_balances clb on clb.customer_id = c.id
  left join lateral (
    select program.*
    from public.loyalty_programs program
    where program.tenant_id = c.tenant_id
    order by (program.status = 'ACTIVE') desc, program.updated_at desc
    limit 1
  ) lp on true
  where cc.public_token = target_card_token
    and cc.status = 'ACTIVE'
    and c.status = 'ACTIVE'
    and t.status = 'ACTIVE';
$$;

revoke all on function app.reward_tiers_are_valid(jsonb) from public, anon, authenticated;
revoke all on function app.replace_reward_tiers(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function app.apply_reward_tiers(uuid, uuid, integer, integer, uuid, uuid) from public, anon, authenticated;
revoke all on function app.save_loyalty_program_with_tiers(
  uuid,
  text,
  public.loyalty_program_status,
  public.loyalty_rule_type,
  bigint,
  integer,
  bigint,
  boolean,
  text,
  jsonb
) from public, anon;
grant execute on function app.save_loyalty_program_with_tiers(
  uuid,
  text,
  public.loyalty_program_status,
  public.loyalty_rule_type,
  bigint,
  integer,
  bigint,
  boolean,
  text,
  jsonb
) to authenticated;

revoke all on function app.create_loyalty_program(
  text,
  public.loyalty_program_status,
  public.loyalty_rule_type,
  bigint,
  integer,
  bigint,
  boolean,
  integer,
  text,
  text,
  integer
) from public, anon;
grant execute on function app.create_loyalty_program(
  text,
  public.loyalty_program_status,
  public.loyalty_rule_type,
  bigint,
  integer,
  bigint,
  boolean,
  integer,
  text,
  text,
  integer
) to authenticated;

revoke all on function app.configure_loyalty_program(
  uuid,
  text,
  public.loyalty_program_status,
  public.loyalty_rule_type,
  bigint,
  integer,
  bigint,
  boolean,
  integer,
  text,
  text,
  integer
) from public, anon;
grant execute on function app.configure_loyalty_program(
  uuid,
  text,
  public.loyalty_program_status,
  public.loyalty_rule_type,
  bigint,
  integer,
  bigint,
  boolean,
  integer,
  text,
  text,
  integer
) to authenticated;

revoke all on function app.confirm_purchase(uuid, uuid, text, bigint, numeric, numeric) from public, anon;
revoke all on function app.cancel_purchase(uuid, text) from public, anon;
revoke all on function app.adjust_customer_stamps(uuid, uuid, integer, text) from public, anon;
grant execute on function app.confirm_purchase(uuid, uuid, text, bigint, numeric, numeric) to authenticated;
grant execute on function app.cancel_purchase(uuid, text) to authenticated;
grant execute on function app.adjust_customer_stamps(uuid, uuid, integer, text) to authenticated;

revoke all on function app.get_public_web_card(text) from public, authenticated;
grant execute on function app.get_public_web_card(text) to anon;
