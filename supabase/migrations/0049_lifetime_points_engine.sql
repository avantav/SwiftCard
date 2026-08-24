-- Enable non-resetting lifetime points with tenths-based accounting while
-- preserving the integer stamp columns used by existing cyclic programs.

alter table public.customer_loyalty_balances
  add column lifetime_points_tenths bigint not null default 0,
  add constraint customer_balances_lifetime_points_nonnegative check (
    lifetime_points_tenths >= 0
      and lifetime_points_tenths <= 21474836470
  );

alter table public.purchases
  add column units_awarded_tenths bigint not null default 0,
  add constraint purchases_units_tenths_nonnegative check (
    units_awarded_tenths >= 0
  );

alter table public.stamp_ledger
  add column units_delta_tenths bigint not null default 0,
  add column balance_after_tenths bigint not null default 0,
  add constraint stamp_ledger_balance_tenths_nonnegative check (
    balance_after_tenths >= 0
  );

update public.purchases
set units_awarded_tenths = stamps_awarded::bigint * 10;

update public.stamp_ledger
set units_delta_tenths = stamps_delta::bigint * 10,
    balance_after_tenths = balance_after::bigint * 10;

update public.customer_loyalty_balances balance
set lifetime_points_tenths = balance.stamp_balance::bigint * 10
where exists (
  select 1
  from public.customer_cards issued
  join public.loyalty_cards card on card.id = issued.loyalty_card_id
  join public.loyalty_programs program on program.id = card.program_id
  where issued.customer_id = balance.customer_id
    and program.program_type = 'LIFETIME_POINTS'
);

-- Scope future stamp-to-point conversions to the customers issued from the
-- program's card. The pre-multi-card implementation converted every balance
-- in the tenant.
create or replace function app.convert_stamp_balances_to_lifetime_points(
  target_tenant_id uuid,
  target_program_id uuid,
  target_previous_program_type public.loyalty_program_type,
  target_multiplier integer,
  target_actor_staff_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  balance_candidate record;
  balance_record record;
  converted_balance integer;
  converted_customer_count integer := 0;
begin
  if target_tenant_id is null or target_program_id is null
    or target_previous_program_type is null
    or target_previous_program_type = 'LIFETIME_POINTS'
    or target_multiplier not between 1 and 1000000
    or not exists (
      select 1 from public.loyalty_programs program
      where program.id = target_program_id
        and program.tenant_id = target_tenant_id
    ) then
    raise check_violation using message = 'Invalid stamp-to-point conversion';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:tenant-program:' || target_tenant_id::text, 0)
  );

  if exists (
    select 1
    from public.customer_loyalty_balances balance
    where balance.tenant_id = target_tenant_id
      and (
        exists (
          select 1
          from public.customer_cards issued
          join public.loyalty_cards card on card.id = issued.loyalty_card_id
          where issued.customer_id = balance.customer_id
            and card.program_id = target_program_id
        )
        or not exists (
          select 1
          from public.customer_cards issued
          where issued.customer_id = balance.customer_id
            and issued.loyalty_card_id is not null
        )
        or not exists (
          select 1 from public.loyalty_cards configured_card
          where configured_card.program_id = target_program_id
        )
      )
      and balance.stamp_balance::bigint * target_multiplier > 2147483647
  ) then
    raise numeric_value_out_of_range using
      message = 'Converted point balance exceeds the supported integer range';
  end if;

  for balance_candidate in
    select balance.customer_id
    from public.customer_loyalty_balances balance
    where balance.tenant_id = target_tenant_id
      and (
        exists (
          select 1
          from public.customer_cards issued
          join public.loyalty_cards card on card.id = issued.loyalty_card_id
          where issued.customer_id = balance.customer_id
            and card.program_id = target_program_id
        )
        or not exists (
          select 1
          from public.customer_cards issued
          where issued.customer_id = balance.customer_id
            and issued.loyalty_card_id is not null
        )
        or not exists (
          select 1 from public.loyalty_cards configured_card
          where configured_card.program_id = target_program_id
        )
      )
      and (balance.stamp_balance <> 0 or balance.remainder_minor <> 0)
    order by balance.customer_id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended('swiftwallet:customer-balance:' || balance_candidate.customer_id::text, 0)
    );

    select balance.* into balance_record
    from public.customer_loyalty_balances balance
    where balance.customer_id = balance_candidate.customer_id
      and balance.tenant_id = target_tenant_id
    for update;

    converted_balance := balance_record.stamp_balance * target_multiplier;

    update public.customer_loyalty_balances
    set stamp_balance = converted_balance,
        lifetime_points_tenths = converted_balance::bigint * 10,
        remainder_minor = 0,
        updated_at = now()
    where customer_id = balance_record.customer_id
      and tenant_id = target_tenant_id;

    insert into public.stamp_ledger (
      tenant_id, customer_id, entry_type, stamps_delta, balance_after,
      remainder_after_minor, reason, created_by_staff_id,
      units_delta_tenths, balance_after_tenths
    ) values (
      target_tenant_id, balance_record.customer_id, 'PROGRAM_CHANGE',
      converted_balance - balance_record.stamp_balance, converted_balance, 0,
      'Conversión de sellos a puntos (1 sello = ' || target_multiplier::text || ' puntos)',
      target_actor_staff_id,
      (converted_balance - balance_record.stamp_balance)::bigint * 10,
      converted_balance::bigint * 10
    );

    converted_customer_count := converted_customer_count + 1;
  end loop;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    target_tenant_id, target_actor_staff_id,
    'LOYALTY_PROGRAM_BALANCES_CONVERTED', 'loyalty_programs', target_program_id,
    jsonb_build_object(
      'previous_program_type', target_previous_program_type,
      'new_program_type', 'LIFETIME_POINTS',
      'conversion', 'STAMPS_TO_POINTS',
      'stamp_to_point_multiplier', target_multiplier,
      'converted_customers', converted_customer_count,
      'remainder_policy', 'DISCARDED'
    )
  );

  return converted_customer_count;
end;
$$;

revoke all on function app.convert_stamp_balances_to_lifetime_points(
  uuid, uuid, public.loyalty_program_type, integer, uuid
) from public, anon, authenticated;

create function app.apply_lifetime_point_milestones(
  target_customer_id uuid,
  target_program_id uuid,
  target_loyalty_card_id uuid,
  target_starting_balance_tenths bigint,
  target_points_added_tenths bigint,
  target_source_purchase_id uuid
)
returns table (final_balance_tenths bigint, rewards_generated integer)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  program_record record;
  tier_record record;
  projected_balance_tenths bigint;
  inserted_count integer;
  generated_count integer := 0;
begin
  if target_starting_balance_tenths < 0 or target_points_added_tenths < 0 then
    raise check_violation using message = 'Invalid lifetime point calculation';
  end if;

  select program.* into program_record
  from public.loyalty_programs program
  join public.loyalty_cards card
    on card.program_id = program.id and card.id = target_loyalty_card_id
  where program.id = target_program_id
    and program.program_type = 'LIFETIME_POINTS';

  projected_balance_tenths := target_starting_balance_tenths + target_points_added_tenths;
  if program_record.id is null or projected_balance_tenths > 21474836470 then
    raise numeric_value_out_of_range using message = 'Lifetime point balance exceeds the supported range';
  end if;

  for tier_record in
    select tier.*
    from public.loyalty_reward_tiers tier
    where tier.program_id = target_program_id
      and tier.active
      and tier.stamps_required::bigint * 10 <= projected_balance_tenths
    order by tier.stamps_required, tier.id
  loop
    if not exists (
      select 1 from public.rewards reward
      where reward.customer_id = target_customer_id
        and reward.reward_tier_id = tier_record.id
    ) then
      insert into public.rewards (
        tenant_id, customer_id, program_id, source_purchase_id,
        reward_tier_id, reward_cycle, stamps_required_snapshot,
        program_version_snapshot, name, description, expires_at,
        loyalty_card_id
      ) values (
        program_record.tenant_id, target_customer_id, target_program_id,
        target_source_purchase_id, tier_record.id, 0,
        tier_record.stamps_required, program_record.version,
        tier_record.name, tier_record.description,
        case when tier_record.expiration_days is null then null
          else now() + make_interval(days => tier_record.expiration_days) end,
        target_loyalty_card_id
      )
      on conflict (customer_id, reward_tier_id, reward_cycle)
        where reward_tier_id is not null and reward_cycle is not null
        do nothing;
      get diagnostics inserted_count = row_count;
      generated_count := generated_count + inserted_count;
    end if;
  end loop;

  update public.customer_loyalty_balances
  set lifetime_points_tenths = projected_balance_tenths,
      stamp_balance = floor(projected_balance_tenths::numeric / 10)::integer,
      remainder_minor = 0,
      updated_at = now()
  where customer_id = target_customer_id;

  return query select projected_balance_tenths, generated_count;
end;
$$;

revoke all on function app.apply_lifetime_point_milestones(
  uuid, uuid, uuid, bigint, bigint, uuid
) from public, anon, authenticated;

create or replace function app.save_loyalty_card_program(
  target_card_id uuid,
  target_name text,
  target_program_type public.loyalty_program_type,
  target_rule_type public.loyalty_rule_type,
  target_minimum_purchase_minor bigint,
  target_stamps_per_purchase integer,
  target_amount_per_stamp_minor bigint,
  target_carry_remainder boolean,
  target_terms_and_conditions text,
  target_reward_tiers jsonb,
  target_unit_name_singular text,
  target_unit_name_plural text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  card_record record;
  top_tier record;
  balance_record record;
begin
  select staff.id, staff.tenant_id into staff_record
  from public.staff_profiles staff
  join public.tenants tenant on tenant.id = staff.tenant_id
  where staff.id = auth.uid() and staff.role = 'ADMIN'
    and staff.status = 'ACTIVE' and tenant.status = 'ACTIVE';

  select card.* into card_record
  from public.loyalty_cards card
  where card.id = target_card_id
    and card.tenant_id = staff_record.tenant_id
    and card.status <> 'ARCHIVED'
  for update;

  if staff_record.id is null or card_record.id is null
    or coalesce(length(btrim(target_name)), 0) not between 1 and 80
    or target_rule_type is null
    or coalesce(length(btrim(target_terms_and_conditions)), 0) not between 10 and 4000
    or coalesce(length(btrim(target_unit_name_singular)), 0) not between 1 and 24
    or coalesce(length(btrim(target_unit_name_plural)), 0) not between 1 and 24
    or target_minimum_purchase_minor not between 0 and 9007199254740991
    or target_stamps_per_purchase not between 1 and 1000000
    or not app.reward_tiers_are_valid(target_reward_tiers)
    or not coalesce(
      (target_program_type = 'STAMPS_PER_PURCHASE'
        and target_rule_type = 'PER_PURCHASE'
        and target_amount_per_stamp_minor is null)
      or (target_program_type = 'STAMPS_PER_AMOUNT'
        and target_rule_type = 'PER_AMOUNT'
        and target_amount_per_stamp_minor between 1 and 9007199254740991)
      or (target_program_type = 'LIFETIME_POINTS'
        and target_rule_type = 'PER_AMOUNT'
        and target_amount_per_stamp_minor between 1 and 9007199254740991
        and not target_carry_remainder), false
    ) then
    return 'INVALID';
  end if;

  select tier.* into top_tier
  from jsonb_to_recordset(target_reward_tiers) as tier(
    stamps_required integer, name text, description text, expiration_days integer
  ) order by stamps_required desc limit 1;

  update public.loyalty_programs
  set name = btrim(target_name),
      status = case when card_record.status = 'PUBLISHED'
        then 'ACTIVE'::public.loyalty_program_status
        else 'PAUSED'::public.loyalty_program_status end,
      program_type = target_program_type,
      rule_type = target_rule_type,
      minimum_purchase_minor = target_minimum_purchase_minor,
      stamps_per_purchase = target_stamps_per_purchase,
      amount_per_stamp_minor = target_amount_per_stamp_minor,
      carry_remainder = case when target_program_type = 'LIFETIME_POINTS'
        then false else target_carry_remainder end,
      reward_stamp_goal = top_tier.stamps_required,
      reward_name = btrim(top_tier.name),
      reward_description = btrim(top_tier.description),
      reward_expiration_days = top_tier.expiration_days,
      terms_and_conditions = btrim(target_terms_and_conditions),
      unit_name_singular = btrim(target_unit_name_singular),
      unit_name_plural = btrim(target_unit_name_plural),
      allow_purchase_cancellations = case when target_program_type = 'LIFETIME_POINTS'
        then false else allow_purchase_cancellations end,
      allow_reward_cancellations = case when target_program_type = 'LIFETIME_POINTS'
        then false else allow_reward_cancellations end,
      version = version + 1,
      updated_at = now()
  where id = card_record.program_id;

  perform app.replace_reward_tiers(
    card_record.program_id, card_record.tenant_id, target_reward_tiers
  );

  if target_program_type = 'LIFETIME_POINTS' then
    for balance_record in
      select balance.customer_id, balance.lifetime_points_tenths
      from public.customer_loyalty_balances balance
      join public.customer_cards issued on issued.customer_id = balance.customer_id
      where issued.loyalty_card_id = target_card_id
      order by balance.customer_id
    loop
      perform app.apply_lifetime_point_milestones(
        balance_record.customer_id, card_record.program_id, target_card_id,
        balance_record.lifetime_points_tenths, 0, null
      );
    end loop;
  end if;

  update public.loyalty_cards
  set name = btrim(target_name), program_completed = true,
      current_step = greatest(current_step, 2),
      updated_by_staff_id = staff_record.id
  where id = target_card_id;

  return 'SAVED';
exception when check_violation or unique_violation or numeric_value_out_of_range then
  return 'INVALID';
end;
$$;

create or replace function app.preview_card_purchase(
  target_customer_card_id uuid,
  target_branch_id uuid,
  target_amount_minor bigint
)
returns table (
  result text, stamps_awarded integer, remainder_after_minor bigint,
  current_balance integer, projected_balance integer, program_version integer
)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  card_record record;
  program_record record;
  balance_record record;
  calculated_stamps integer;
  calculated_tenths bigint;
  calculated_remainder bigint;
  current_tenths bigint;
  projected_tenths bigint;
begin
  select staff.id, staff.tenant_id into staff_record
  from public.staff_profiles staff join public.tenants tenant on tenant.id = staff.tenant_id
  where staff.id = auth.uid() and staff.status = 'ACTIVE' and tenant.status = 'ACTIVE';
  select issued.customer_id, issued.tenant_id, issued.status, issued.loyalty_card_id
    into card_record
  from public.customer_cards issued join public.customers customer on customer.id = issued.customer_id
  where issued.id = target_customer_card_id and customer.status = 'ACTIVE';
  select program.* into program_record
  from public.loyalty_cards card
  join public.loyalty_programs program on program.id = card.program_id
  join public.loyalty_card_branches assignment
    on assignment.loyalty_card_id = card.id and assignment.branch_id = target_branch_id
  where card.id = card_record.loyalty_card_id and card.status = 'PUBLISHED';
  if staff_record.id is null or card_record.status <> 'ACTIVE'
    or card_record.tenant_id is distinct from staff_record.tenant_id
    or program_record.id is null or program_record.status <> 'ACTIVE'
    or target_amount_minor is null or target_amount_minor <= 0
    or not app.current_staff_can_access_branch(target_branch_id) then
    return query select 'UNAVAILABLE', 0, 0::bigint, 0, 0, 0;
    return;
  end if;
  select coalesce(balance.stamp_balance, 0) stamp_balance,
         coalesce(balance.remainder_minor, 0) remainder_minor,
         coalesce(balance.lifetime_points_tenths, 0) lifetime_points_tenths
    into balance_record
  from public.customer_loyalty_balances balance
  where balance.customer_id = card_record.customer_id;

  if program_record.program_type = 'LIFETIME_POINTS' then
    calculated_tenths := floor(
      target_amount_minor::numeric * 10 / program_record.amount_per_stamp_minor
    )::bigint;
    current_tenths := coalesce(balance_record.lifetime_points_tenths, 0);
    projected_tenths := current_tenths + calculated_tenths;
    if projected_tenths > 21474836470 then
      return query select 'UNAVAILABLE', 0, 0::bigint, 0, 0, 0;
      return;
    end if;
    return query select 'PREVIEW', floor(calculated_tenths::numeric / 10)::integer,
      0::bigint, floor(current_tenths::numeric / 10)::integer,
      floor(projected_tenths::numeric / 10)::integer, program_record.version;
    return;
  elsif program_record.rule_type = 'PER_PURCHASE' then
    calculated_stamps := case when target_amount_minor >= program_record.minimum_purchase_minor
      then program_record.stamps_per_purchase else 0 end;
    calculated_remainder := coalesce(balance_record.remainder_minor, 0);
  else
    calculated_stamps := floor((target_amount_minor + case when program_record.carry_remainder
      then coalesce(balance_record.remainder_minor, 0) else 0 end)
      / program_record.amount_per_stamp_minor)::integer;
    calculated_remainder := case when program_record.carry_remainder
      then (target_amount_minor + coalesce(balance_record.remainder_minor, 0)) % program_record.amount_per_stamp_minor
      else target_amount_minor % program_record.amount_per_stamp_minor end;
  end if;
  return query select 'PREVIEW', calculated_stamps, calculated_remainder,
    coalesce(balance_record.stamp_balance, 0),
    (coalesce(balance_record.stamp_balance, 0) + calculated_stamps) % program_record.reward_stamp_goal,
    program_record.version;
end;
$$;

create or replace function app.confirm_card_purchase(
  target_customer_card_id uuid,
  target_branch_id uuid,
  target_ticket_number text,
  target_amount_minor bigint,
  target_latitude numeric,
  target_longitude numeric
)
returns table (
  result text, purchase_id uuid, stamps_awarded integer,
  rewards_generated integer, remainder_after_minor bigint
)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  issued_record record;
  program_record record;
  balance_record record;
  calculated_stamps integer;
  calculated_tenths bigint;
  calculated_remainder bigint;
  purchase_id_value uuid;
  tier_result record;
  final_balance_integer integer;
  final_balance_tenths_value bigint;
  generated_rewards integer := 0;
  completed_cycles_value integer := 0;
begin
  select staff.id, staff.tenant_id into staff_record
  from public.staff_profiles staff join public.tenants tenant on tenant.id = staff.tenant_id
  where staff.id = auth.uid() and staff.status = 'ACTIVE' and tenant.status = 'ACTIVE';
  select issued.customer_id, issued.tenant_id, issued.status, issued.loyalty_card_id
    into issued_record
  from public.customer_cards issued join public.customers customer on customer.id = issued.customer_id
  where issued.id = target_customer_card_id and customer.status = 'ACTIVE';
  select program.* into program_record
  from public.loyalty_cards card
  join public.loyalty_programs program on program.id = card.program_id
  join public.loyalty_card_branches assignment
    on assignment.loyalty_card_id = card.id and assignment.branch_id = target_branch_id
  where card.id = issued_record.loyalty_card_id and card.status = 'PUBLISHED';
  if staff_record.id is null or issued_record.status <> 'ACTIVE'
    or issued_record.tenant_id is distinct from staff_record.tenant_id
    or program_record.id is null or program_record.status <> 'ACTIVE'
    or not app.current_staff_can_access_branch(target_branch_id)
    or nullif(btrim(target_ticket_number), '') is null
    or target_amount_minor is null or target_amount_minor <= 0 then
    return query select 'UNAVAILABLE', null::uuid, 0, 0, 0::bigint;
    return;
  end if;
  if exists (select 1 from public.purchases purchase
    where purchase.branch_id = target_branch_id
      and purchase.ticket_number = btrim(target_ticket_number)) then
    return query select 'DUPLICATE_TICKET', null::uuid, 0, 0, 0::bigint;
    return;
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:customer-balance:' || issued_record.customer_id::text, 0)
  );
  select balance.* into balance_record
  from public.customer_loyalty_balances balance
  where balance.customer_id = issued_record.customer_id for update;
  if balance_record.id is null then
    insert into public.customer_loyalty_balances (tenant_id, customer_id)
    values (staff_record.tenant_id, issued_record.customer_id);
    select balance.* into balance_record
    from public.customer_loyalty_balances balance
    where balance.customer_id = issued_record.customer_id for update;
  end if;

  if program_record.program_type = 'LIFETIME_POINTS' then
    calculated_tenths := floor(
      target_amount_minor::numeric * 10 / program_record.amount_per_stamp_minor
    )::bigint;
    if balance_record.lifetime_points_tenths + calculated_tenths > 21474836470 then
      return query select 'UNAVAILABLE', null::uuid, 0, 0, 0::bigint;
      return;
    end if;
    calculated_stamps := floor(calculated_tenths::numeric / 10)::integer;
    calculated_remainder := 0;
  elsif program_record.rule_type = 'PER_PURCHASE' then
    calculated_stamps := case when target_amount_minor >= program_record.minimum_purchase_minor
      then program_record.stamps_per_purchase else 0 end;
    calculated_tenths := calculated_stamps::bigint * 10;
    calculated_remainder := balance_record.remainder_minor;
  else
    calculated_stamps := floor((target_amount_minor + case when program_record.carry_remainder
      then balance_record.remainder_minor else 0 end) / program_record.amount_per_stamp_minor)::integer;
    calculated_tenths := calculated_stamps::bigint * 10;
    calculated_remainder := case when program_record.carry_remainder
      then (target_amount_minor + balance_record.remainder_minor) % program_record.amount_per_stamp_minor
      else target_amount_minor % program_record.amount_per_stamp_minor end;
  end if;

  insert into public.purchases (
    tenant_id, customer_id, branch_id, staff_profile_id, ticket_number,
    amount_minor, latitude, longitude, rule_type, program_version,
    stamps_awarded, units_awarded_tenths,
    remainder_before_minor, remainder_after_minor, reward_cycle_goal,
    loyalty_card_id, program_id
  ) values (
    staff_record.tenant_id, issued_record.customer_id, target_branch_id,
    staff_record.id, btrim(target_ticket_number), target_amount_minor,
    target_latitude, target_longitude, program_record.rule_type,
    program_record.version, calculated_stamps, calculated_tenths,
    balance_record.remainder_minor, calculated_remainder,
    case when program_record.program_type = 'LIFETIME_POINTS'
      then null else program_record.reward_stamp_goal end,
    issued_record.loyalty_card_id, program_record.id
  ) returning id into purchase_id_value;

  if program_record.program_type = 'LIFETIME_POINTS' then
    select * into tier_result from app.apply_lifetime_point_milestones(
      issued_record.customer_id, program_record.id, issued_record.loyalty_card_id,
      balance_record.lifetime_points_tenths, calculated_tenths, purchase_id_value
    );
    final_balance_tenths_value := tier_result.final_balance_tenths;
    final_balance_integer := floor(final_balance_tenths_value::numeric / 10)::integer;
    generated_rewards := tier_result.rewards_generated;
  else
    select * into tier_result from app.apply_reward_tiers(
      issued_record.customer_id, program_record.id, balance_record.stamp_balance,
      calculated_stamps, purchase_id_value, null
    );
    final_balance_integer := tier_result.final_balance;
    final_balance_tenths_value := tier_result.final_balance::bigint * 10;
    generated_rewards := tier_result.rewards_generated;
    completed_cycles_value := tier_result.cycles_completed;
    update public.customer_loyalty_balances
    set remainder_minor = calculated_remainder, updated_at = now()
    where customer_id = issued_record.customer_id;
    update public.purchases
    set reward_cycles_completed = completed_cycles_value
    where id = purchase_id_value;
  end if;

  insert into public.stamp_ledger (
    tenant_id, customer_id, entry_type, purchase_id, stamps_delta,
    balance_after, remainder_after_minor, created_by_staff_id, loyalty_card_id,
    units_delta_tenths, balance_after_tenths
  ) values (
    staff_record.tenant_id, issued_record.customer_id, 'PURCHASE', purchase_id_value,
    calculated_stamps, final_balance_integer,
    calculated_remainder, staff_record.id, issued_record.loyalty_card_id,
    calculated_tenths, final_balance_tenths_value
  );

  return query select 'CONFIRMED', purchase_id_value, calculated_stamps,
    generated_rewards, calculated_remainder;
exception when unique_violation then
  return query select 'DUPLICATE_TICKET', null::uuid, 0, 0, 0::bigint;
end;
$$;

-- Preserve the established employee projection shape while returning the
-- integer customer-facing portion of a lifetime balance.
create or replace function app.get_staff_customer_card_summary(target_customer_card_id uuid)
returns table (
  customer_id uuid, customer_name text, customer_phone text,
  customer_card_id uuid, loyalty_card_id uuid, card_name text,
  program_name text, program_status text, stamp_balance integer,
  unit_name_singular text, unit_name_plural text, available_rewards jsonb
)
language sql stable security definer set search_path = public, app, auth, extensions
as $$
  select customer.id, customer.full_name, customer.normalized_phone,
    issued.id, card.id, card.name, program.name, program.status::text,
    case when program.program_type = 'LIFETIME_POINTS'
      then floor(coalesce(balance.lifetime_points_tenths, 0)::numeric / 10)::integer
      else coalesce(balance.stamp_balance, 0) end,
    program.unit_name_singular, program.unit_name_plural,
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', reward.id, 'name', reward.name, 'description', reward.description,
      'expires_at', reward.expires_at
    ) order by reward.expires_at nulls last, reward.created_at, reward.id)
      from public.rewards reward
      where reward.customer_id = customer.id
        and reward.loyalty_card_id = card.id
        and reward.status = 'AVAILABLE'
        and (reward.expires_at is null or reward.expires_at > now())), '[]'::jsonb)
  from public.staff_profiles staff
  join public.tenants tenant on tenant.id = staff.tenant_id and tenant.status = 'ACTIVE'
  join public.customer_cards issued on issued.id = target_customer_card_id
    and issued.tenant_id = staff.tenant_id and issued.status = 'ACTIVE'
  join public.customers customer on customer.id = issued.customer_id and customer.status = 'ACTIVE'
  join public.loyalty_cards card on card.id = issued.loyalty_card_id and card.status = 'PUBLISHED'
  join public.loyalty_programs program on program.id = card.program_id
  left join public.customer_loyalty_balances balance on balance.customer_id = customer.id
  where staff.id = auth.uid()
    and staff.status = 'ACTIVE'
    and (
      (
        staff.account_kind = 'INDIVIDUAL'
        and (
          staff.role = 'MANAGER'
          or exists (
            select 1 from public.staff_branch_assignments assignment
            where assignment.staff_profile_id = staff.id
              and app.current_staff_can_access_branch(assignment.branch_id)
          )
        )
      )
      or app.current_pin_operator_id() is not null
    );
$$;

drop function if exists app.get_public_web_card(text);
create function app.get_public_web_card(target_card_token text)
returns table (
  tenant_name text, branding_mode public.branding_mode, logo_url text,
  primary_color text, secondary_color text, customer_name text,
  program_name text, program_status text, program_type text,
  stamp_balance integer, balance_tenths bigint,
  reward_goal integer, unit_name_singular text, unit_name_plural text,
  terms_and_conditions text, reward_tiers jsonb, available_rewards jsonb
)
language sql security definer set search_path = public, app, auth
as $$
  select tenant.name, tenant.branding_mode,
    coalesce(card.logo_image_url, tenant.logo_url),
    card.foreground_color, card.background_color,
    customer.full_name, program.name, program.status::text, program.program_type::text,
    case when program.program_type = 'LIFETIME_POINTS'
      then floor(coalesce(balance.lifetime_points_tenths, 0)::numeric / 10)::integer
      else coalesce(balance.stamp_balance, 0) end,
    case when program.program_type = 'LIFETIME_POINTS'
      then coalesce(balance.lifetime_points_tenths, 0)
      else coalesce(balance.stamp_balance, 0)::bigint * 10 end,
    program.reward_stamp_goal, program.unit_name_singular, program.unit_name_plural,
    program.terms_and_conditions,
    coalesce((select jsonb_agg(jsonb_build_object(
      'stamps_required', tier.stamps_required, 'name', tier.name,
      'description', tier.description, 'expiration_days', tier.expiration_days
    ) order by tier.stamps_required, tier.id)
      from public.loyalty_reward_tiers tier
      where tier.program_id = program.id and tier.active), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
      'name', reward.name, 'description', reward.description,
      'stamps_required', reward.stamps_required_snapshot,
      'expires_at', reward.expires_at
    ) order by reward.created_at, reward.id)
      from public.rewards reward
      where reward.customer_id = customer.id
        and reward.loyalty_card_id = card.id
        and reward.status = 'AVAILABLE'
        and (reward.expires_at is null or reward.expires_at > now())), '[]'::jsonb)
  from public.customer_cards issued
  join public.customers customer on customer.id = issued.customer_id
  join public.tenants tenant on tenant.id = issued.tenant_id
  join public.loyalty_cards card on card.id = issued.loyalty_card_id
  join public.loyalty_programs program on program.id = card.program_id
  left join public.customer_loyalty_balances balance on balance.customer_id = customer.id
  where issued.public_token = target_card_token and issued.status = 'ACTIVE'
    and customer.status = 'ACTIVE' and tenant.status = 'ACTIVE'
    and card.status = 'PUBLISHED';
$$;

revoke all on function app.get_public_web_card(text) from public, authenticated;
grant execute on function app.get_public_web_card(text) to anon;

-- Administrative projections keep one decimal for both cyclic units and
-- lifetime points. Existing customer and employee projections remain integer.
drop function if exists app.get_loyalty_card_stats(uuid);

create function app.get_loyalty_card_stats(target_card_id uuid)
returns table (
  issued_cards bigint,
  purchase_count bigint,
  purchase_amount_minor bigint,
  units_awarded numeric(20, 1),
  rewards_generated bigint,
  rewards_redeemed bigint
)
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select
    (select count(*) from public.customer_cards issued
      where issued.loyalty_card_id = card.id and issued.status = 'ACTIVE'),
    (select count(*) from public.purchases purchase
      where purchase.loyalty_card_id = card.id and purchase.status = 'CONFIRMED'),
    coalesce((select sum(purchase.amount_minor) from public.purchases purchase
      where purchase.loyalty_card_id = card.id and purchase.status = 'CONFIRMED'), 0),
    (coalesce((select sum(purchase.units_awarded_tenths)
      from public.purchases purchase
      where purchase.loyalty_card_id = card.id and purchase.status = 'CONFIRMED'), 0)::numeric
      / 10)::numeric(20, 1),
    (select count(*) from public.rewards reward where reward.loyalty_card_id = card.id),
    (select count(*) from public.rewards reward
      where reward.loyalty_card_id = card.id and reward.status = 'REDEEMED')
  from public.loyalty_cards card
  where card.id = target_card_id
    and (app.is_superadmin() or app.current_staff_can_manage_tenant(card.tenant_id));
$$;

drop function if exists app.get_dashboard_metrics(uuid, timestamptz, timestamptz);

create function app.get_dashboard_metrics(
  target_branch_id uuid default null,
  from_date timestamptz default null,
  to_date timestamptz default null
)
returns table (
  customer_count bigint,
  new_customer_count bigint,
  purchase_count bigint,
  purchase_amount_minor bigint,
  stamps_awarded numeric(20, 1),
  rewards_generated bigint,
  rewards_redeemed bigint
)
language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
declare staff_record record; branch_allowed boolean;
begin
  select staff.id, staff.tenant_id, staff.role into staff_record
  from public.staff_profiles staff join public.tenants tenant on tenant.id = staff.tenant_id
  where staff.id = auth.uid() and staff.status = 'ACTIVE' and tenant.status = 'ACTIVE';
  if staff_record.id is null or staff_record.role not in ('ADMIN', 'MANAGER') then
    return query select 0::bigint, 0::bigint, 0::bigint, 0::bigint,
      0::numeric(20, 1), 0::bigint, 0::bigint;
    return;
  end if;
  if target_branch_id is not null then
    branch_allowed := exists (
      select 1 from public.branches branch
      where branch.id = target_branch_id
        and branch.tenant_id = staff_record.tenant_id and branch.status = 'ACTIVE'
        and (staff_record.role = 'ADMIN' or exists (
          select 1 from public.staff_branch_assignments assignment
          where assignment.branch_id = branch.id
            and assignment.staff_profile_id = staff_record.id
        ))
    );
    if not branch_allowed then
      return query select 0::bigint, 0::bigint, 0::bigint, 0::bigint,
        0::numeric(20, 1), 0::bigint, 0::bigint;
      return;
    end if;
  end if;
  return query
  with accessible_branches as (
    select branch.id from public.branches branch
    where branch.tenant_id = staff_record.tenant_id and branch.status = 'ACTIVE'
      and (target_branch_id is null or branch.id = target_branch_id)
      and (staff_record.role = 'ADMIN' or exists (
        select 1 from public.staff_branch_assignments assignment
        where assignment.branch_id = branch.id
          and assignment.staff_profile_id = staff_record.id
      ))
  ), scoped_customers as (
    select customer.* from public.customers customer
    join accessible_branches branch on branch.id = customer.source_branch_id
    where (from_date is null or customer.created_at >= from_date)
      and (to_date is null or customer.created_at < to_date)
  ), scoped_purchases as (
    select purchase.* from public.purchases purchase
    join accessible_branches branch on branch.id = purchase.branch_id
    where purchase.status = 'CONFIRMED'
      and (from_date is null or purchase.created_at >= from_date)
      and (to_date is null or purchase.created_at < to_date)
  )
  select
    (select count(*) from scoped_customers),
    (select count(*) from scoped_customers where registration_method is not null),
    (select count(*) from scoped_purchases),
    coalesce((select sum(purchase.amount_minor) from scoped_purchases purchase), 0::bigint)::bigint,
    (coalesce((select sum(purchase.units_awarded_tenths)
      from scoped_purchases purchase), 0)::numeric / 10)::numeric(20, 1),
    (select count(*) from public.rewards reward
      where reward.tenant_id = staff_record.tenant_id
        and reward.source_purchase_id in (select id from scoped_purchases)),
    (select count(*) from public.reward_redemptions redemption
      join accessible_branches branch on branch.id = redemption.branch_id
      where redemption.status = 'COMPLETED'
        and (from_date is null or redemption.redeemed_at >= from_date)
        and (to_date is null or redemption.redeemed_at < to_date));
end;
$$;

drop function if exists app.get_dashboard_branch_metrics(timestamptz, timestamptz);

create function app.get_dashboard_branch_metrics(
  from_date timestamptz default null,
  to_date timestamptz default null
)
returns table (
  branch_id uuid,
  branch_name text,
  customer_count bigint,
  purchase_count bigint,
  purchase_amount_minor bigint,
  stamps_awarded numeric(20, 1)
)
language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
declare staff_record record;
begin
  select staff.id, staff.tenant_id, staff.role into staff_record
  from public.staff_profiles staff join public.tenants tenant on tenant.id = staff.tenant_id
  where staff.id = auth.uid() and staff.status = 'ACTIVE' and tenant.status = 'ACTIVE';
  if staff_record.id is null or staff_record.role not in ('ADMIN', 'MANAGER') then
    return;
  end if;
  return query
  with allowed as (
    select branch.id, branch.name from public.branches branch
    where branch.tenant_id = staff_record.tenant_id and branch.status = 'ACTIVE'
      and (staff_record.role = 'ADMIN' or exists (
        select 1 from public.staff_branch_assignments assignment
        where assignment.branch_id = branch.id
          and assignment.staff_profile_id = staff_record.id
      ))
  ), customers_by_branch as (
    select customer.source_branch_id, count(*) as customer_count
    from public.customers customer join allowed branch on branch.id = customer.source_branch_id
    where (from_date is null or customer.created_at >= from_date)
      and (to_date is null or customer.created_at < to_date)
    group by customer.source_branch_id
  ), purchases_by_branch as (
    select purchase.branch_id, count(*) as purchase_count,
      coalesce(sum(purchase.amount_minor), 0)::bigint as purchase_amount_minor,
      (coalesce(sum(purchase.units_awarded_tenths), 0)::numeric / 10)::numeric(20, 1)
        as stamps_awarded
    from public.purchases purchase join allowed branch on branch.id = purchase.branch_id
    where purchase.status = 'CONFIRMED'
      and (from_date is null or purchase.created_at >= from_date)
      and (to_date is null or purchase.created_at < to_date)
    group by purchase.branch_id
  )
  select branch.id, branch.name,
    coalesce(customer.customer_count, 0)::bigint,
    coalesce(purchase.purchase_count, 0)::bigint,
    coalesce(purchase.purchase_amount_minor, 0)::bigint,
    coalesce(purchase.stamps_awarded, 0)::numeric(20, 1)
  from allowed branch
  left join customers_by_branch customer on customer.source_branch_id = branch.id
  left join purchases_by_branch purchase on purchase.branch_id = branch.id
  order by branch.name;
end;
$$;

-- Accumulated points are definitive in the first release. Enforce those
-- policies in the database even if a legacy administrative path is called.
update public.loyalty_programs
set allow_purchase_cancellations = false,
    allow_reward_cancellations = false
where program_type = 'LIFETIME_POINTS';

alter table public.loyalty_programs
  add constraint lifetime_points_cancellations_disabled check (
    program_type <> 'LIFETIME_POINTS'
      or (not allow_purchase_cancellations and not allow_reward_cancellations)
  );

create function app.enforce_program_cancellation_policy()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth
as $$
begin
  if tg_table_name = 'purchases'
    and old.status::text = 'CONFIRMED' and new.status::text = 'CANCELLED'
    and exists (
      select 1 from public.loyalty_programs program
      where program.id = new.program_id and not program.allow_purchase_cancellations
    ) then
    raise check_violation using message = 'Purchase cancellation is disabled for this program';
  elsif tg_table_name = 'rewards'
    and old.status::text = 'AVAILABLE' and new.status::text = 'CANCELLED'
    and exists (
      select 1 from public.loyalty_programs program
      where program.id = new.program_id
        and program.program_type = 'LIFETIME_POINTS'
        and not program.allow_reward_cancellations
    ) then
    raise check_violation using message = 'Reward cancellation is disabled for this program';
  end if;
  return new;
end;
$$;

create trigger purchases_enforce_program_cancellation_policy
  before update of status on public.purchases
  for each row execute function app.enforce_program_cancellation_policy();

create trigger rewards_enforce_program_cancellation_policy
  before update of status on public.rewards
  for each row execute function app.enforce_program_cancellation_policy();

-- Lifetime points cannot use the legacy stamp-adjustment path because that
-- path intentionally performs cyclic balance resets.
create function app.reject_lifetime_point_adjustment()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth
as $$
begin
  if exists (
    select 1
    from public.customer_cards issued
    join public.loyalty_cards card on card.id = issued.loyalty_card_id
    join public.loyalty_programs program on program.id = card.program_id
    where issued.customer_id = new.customer_id
      and program.program_type = 'LIFETIME_POINTS'
  ) then
    raise check_violation using message = 'Manual lifetime point adjustments are disabled';
  end if;
  return new;
end;
$$;

create trigger stamp_adjustments_reject_lifetime_points
  before insert on public.stamp_adjustments
  for each row execute function app.reject_lifetime_point_adjustment();

revoke all on function app.reject_lifetime_point_adjustment()
  from public, anon, authenticated;
revoke all on function app.enforce_program_cancellation_policy()
  from public, anon, authenticated;

revoke all on function app.get_loyalty_card_stats(uuid) from public, anon;
revoke all on function app.get_dashboard_metrics(uuid, timestamptz, timestamptz)
  from public, anon;
revoke all on function app.get_dashboard_branch_metrics(timestamptz, timestamptz)
  from public, anon;
grant execute on function app.get_loyalty_card_stats(uuid) to authenticated;
grant execute on function app.get_dashboard_metrics(uuid, timestamptz, timestamptz)
  to authenticated;
grant execute on function app.get_dashboard_branch_metrics(timestamptz, timestamptz)
  to authenticated;

revoke all on function app.save_loyalty_card_program(
  uuid, text, public.loyalty_program_type, public.loyalty_rule_type,
  bigint, integer, bigint, boolean, text, jsonb, text, text
) from public, anon;
grant execute on function app.save_loyalty_card_program(
  uuid, text, public.loyalty_program_type, public.loyalty_rule_type,
  bigint, integer, bigint, boolean, text, jsonb, text, text
) to authenticated;

revoke all on function app.preview_card_purchase(uuid, uuid, bigint) from public, anon;
revoke all on function app.confirm_card_purchase(uuid, uuid, text, bigint, numeric, numeric) from public, anon;
grant execute on function app.preview_card_purchase(uuid, uuid, bigint) to authenticated;
grant execute on function app.confirm_card_purchase(uuid, uuid, text, bigint, numeric, numeric) to authenticated;

revoke all on function app.get_staff_customer_card_summary(uuid) from public, anon, authenticated;
grant execute on function app.get_staff_customer_card_summary(uuid) to authenticated;
