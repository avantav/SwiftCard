-- Route registration, scanning, earning, public cards, and Wallet availability
-- through the issued card instead of selecting a tenant-wide active program.

create function app.register_public_customer(
  target_branch_token text,
  target_loyalty_card_id uuid,
  target_full_name text,
  target_normalized_phone text,
  target_email text,
  target_birth_date date,
  target_privacy_consent boolean
)
returns table (result text, card_token text)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  branch_record record;
  card_record record;
  customer_id_value uuid;
  card_token_value text;
begin
  if not target_privacy_consent
    or nullif(btrim(target_branch_token), '') is null
    or nullif(btrim(target_full_name), '') is null
    or target_normalized_phone !~ '^\+[1-9][0-9]{7,14}$' then
    return query select 'INVALID', null::text;
    return;
  end if;

  select branch.id, branch.tenant_id into branch_record
  from public.branches branch
  join public.tenants tenant on tenant.id = branch.tenant_id
  where branch.public_registration_token = target_branch_token
    and branch.status = 'ACTIVE' and tenant.status = 'ACTIVE';
  select card.id, card.tenant_id, card.program_id into card_record
  from public.loyalty_cards card
  join public.loyalty_programs program on program.id = card.program_id
  join public.loyalty_card_branches assignment
    on assignment.loyalty_card_id = card.id and assignment.branch_id = branch_record.id
  where card.id = target_loyalty_card_id
    and card.tenant_id = branch_record.tenant_id
    and card.status = 'PUBLISHED' and program.status = 'ACTIVE';

  if branch_record.id is null or card_record.id is null then
    return query select 'UNAVAILABLE', null::text;
    return;
  end if;
  if exists (select 1 from public.customers customer
    where customer.tenant_id = branch_record.tenant_id
      and customer.normalized_phone = target_normalized_phone) then
    return query select 'DUPLICATE', null::text;
    return;
  end if;

  begin
    insert into public.customers (
      tenant_id, full_name, normalized_phone, email, birth_date,
      privacy_consent, registration_method, source_branch_id
    ) values (
      branch_record.tenant_id, btrim(target_full_name), target_normalized_phone,
      nullif(lower(btrim(target_email)), ''), target_birth_date,
      true, 'SELF_SERVICE', branch_record.id
    ) returning id into customer_id_value;
    insert into public.customer_cards (tenant_id, customer_id, loyalty_card_id)
    values (branch_record.tenant_id, customer_id_value, card_record.id)
    returning public_token into card_token_value;
  exception when unique_violation then
    return query select 'DUPLICATE', null::text;
    return;
  end;
  return query select 'CREATED', card_token_value;
end;
$$;

create function app.register_employee_customer(
  target_branch_id uuid,
  target_loyalty_card_id uuid,
  target_full_name text,
  target_normalized_phone text,
  target_email text,
  target_birth_date date,
  target_privacy_consent boolean
)
returns table (result text, card_token text)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  card_record record;
  customer_id_value uuid;
  card_token_value text;
begin
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp join public.tenants tenant on tenant.id = sp.tenant_id
  where sp.id = auth.uid() and sp.status = 'ACTIVE' and tenant.status = 'ACTIVE';
  select card.id, card.program_id into card_record
  from public.loyalty_cards card
  join public.loyalty_programs program on program.id = card.program_id
  join public.loyalty_card_branches assignment
    on assignment.loyalty_card_id = card.id and assignment.branch_id = target_branch_id
  where card.id = target_loyalty_card_id
    and card.tenant_id = staff_record.tenant_id
    and card.status = 'PUBLISHED' and program.status = 'ACTIVE';
  if staff_record.id is null or card_record.id is null
    or not app.current_staff_can_access_branch(target_branch_id)
    or not target_privacy_consent
    or nullif(btrim(target_full_name), '') is null
    or target_normalized_phone !~ '^\+[1-9][0-9]{7,14}$' then
    return query select 'UNAVAILABLE', null::text;
    return;
  end if;
  if exists (select 1 from public.customers customer
    where customer.tenant_id = staff_record.tenant_id
      and customer.normalized_phone = target_normalized_phone) then
    return query select 'DUPLICATE', null::text;
    return;
  end if;
  begin
    insert into public.customers (
      tenant_id, full_name, normalized_phone, email, birth_date,
      privacy_consent, registration_method, source_branch_id, created_by_staff_id
    ) values (
      staff_record.tenant_id, btrim(target_full_name), target_normalized_phone,
      nullif(lower(btrim(target_email)), ''), target_birth_date,
      true, 'EMPLOYEE', target_branch_id, staff_record.id
    ) returning id into customer_id_value;
    insert into public.customer_cards (tenant_id, customer_id, loyalty_card_id)
    values (staff_record.tenant_id, customer_id_value, card_record.id)
    returning public_token into card_token_value;
  exception when unique_violation then
    return query select 'DUPLICATE', null::text;
    return;
  end;
  return query select 'CREATED', card_token_value;
end;
$$;

create function app.get_staff_registration_scopes()
returns table (
  loyalty_card_id uuid,
  card_name text,
  branch_id uuid,
  branch_name text
)
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select card.id, card.name, branch.id, branch.name
  from public.staff_profiles staff
  join public.tenants tenant
    on tenant.id = staff.tenant_id and tenant.status = 'ACTIVE'
  join public.loyalty_cards card
    on card.tenant_id = staff.tenant_id and card.status = 'PUBLISHED'
  join public.loyalty_programs program
    on program.id = card.program_id and program.status = 'ACTIVE'
  join public.loyalty_card_branches assignment
    on assignment.loyalty_card_id = card.id
  join public.branches branch
    on branch.id = assignment.branch_id and branch.status = 'ACTIVE'
  where staff.id = auth.uid()
    and staff.status = 'ACTIVE'
    and app.current_staff_can_access_branch(branch.id)
  order by card.name, branch.name;
$$;

drop function if exists app.resolve_staff_card_scan(text);
create function app.resolve_staff_card_scan(target_card_token text)
returns table (
  result text,
  customer_id uuid,
  customer_card_id uuid,
  loyalty_card_id uuid,
  customer_name text,
  card_name text
)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_tenant_id uuid;
  card_record record;
begin
  select sp.tenant_id into staff_tenant_id
  from public.staff_profiles sp join public.tenants tenant on tenant.id = sp.tenant_id
  where sp.id = auth.uid() and sp.status = 'ACTIVE' and tenant.status = 'ACTIVE'
    and (
      (
        sp.account_kind = 'INDIVIDUAL'
        and (
          sp.role = 'MANAGER'
          or exists (
            select 1 from public.staff_branch_assignments assignment
            where assignment.staff_profile_id = sp.id
              and app.current_staff_can_access_branch(assignment.branch_id)
          )
        )
      )
      or app.current_pin_operator_id() is not null
    );
  if staff_tenant_id is null then
    return query select 'UNAVAILABLE', null::uuid, null::uuid, null::uuid, null::text, null::text;
    return;
  end if;
  select issued.tenant_id, issued.customer_id, issued.id as customer_card_id,
         issued.loyalty_card_id, customer.full_name, card.name as card_name
  into card_record
  from public.customer_cards issued
  join public.customers customer on customer.id = issued.customer_id
  left join public.loyalty_cards card on card.id = issued.loyalty_card_id
  where issued.public_token = target_card_token
    and issued.status = 'ACTIVE' and customer.status = 'ACTIVE'
    and (issued.loyalty_card_id is null or card.status = 'PUBLISHED');
  if card_record.customer_card_id is null
    or card_record.tenant_id is distinct from staff_tenant_id then
    return query select 'NOT_THIS_TENANT', null::uuid, null::uuid, null::uuid, null::text, null::text;
    return;
  end if;
  return query select 'FOUND', card_record.customer_id, card_record.customer_card_id,
    card_record.loyalty_card_id, card_record.full_name, card_record.card_name;
end;
$$;

create function app.preview_card_purchase(
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
  calculated_remainder bigint;
begin
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp join public.tenants tenant on tenant.id = sp.tenant_id
  where sp.id = auth.uid() and sp.status = 'ACTIVE' and tenant.status = 'ACTIVE';
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
         coalesce(balance.remainder_minor, 0) remainder_minor into balance_record
  from public.customer_loyalty_balances balance where balance.customer_id = card_record.customer_id;
  if program_record.rule_type = 'PER_PURCHASE' then
    calculated_stamps := case when target_amount_minor >= program_record.minimum_purchase_minor then program_record.stamps_per_purchase else 0 end;
    calculated_remainder := coalesce(balance_record.remainder_minor, 0);
  else
    calculated_stamps := floor((target_amount_minor + case when program_record.carry_remainder then coalesce(balance_record.remainder_minor, 0) else 0 end) / program_record.amount_per_stamp_minor)::integer;
    calculated_remainder := case when program_record.carry_remainder then (target_amount_minor + coalesce(balance_record.remainder_minor, 0)) % program_record.amount_per_stamp_minor else target_amount_minor % program_record.amount_per_stamp_minor end;
  end if;
  return query select 'PREVIEW', calculated_stamps, calculated_remainder,
    coalesce(balance_record.stamp_balance, 0),
    (coalesce(balance_record.stamp_balance, 0) + calculated_stamps) % program_record.reward_stamp_goal,
    program_record.version;
end;
$$;

create function app.confirm_card_purchase(
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
  calculated_remainder bigint;
  purchase_id_value uuid;
  tier_result record;
begin
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp join public.tenants tenant on tenant.id = sp.tenant_id
  where sp.id = auth.uid() and sp.status = 'ACTIVE' and tenant.status = 'ACTIVE';
  select issued.customer_id, issued.tenant_id, issued.status, issued.loyalty_card_id
  into issued_record
  from public.customer_cards issued join public.customers customer on customer.id = issued.customer_id
  where issued.id = target_customer_card_id and customer.status = 'ACTIVE';
  if issued_record.loyalty_card_id is null then
    select program.* into program_record
    from public.loyalty_programs program
    where program.tenant_id = staff_record.tenant_id
    order by (program.status = 'ACTIVE') desc, program.updated_at desc, program.id limit 1;
  else
    select program.* into program_record
    from public.loyalty_cards card
    join public.loyalty_programs program on program.id = card.program_id
    join public.loyalty_card_branches assignment
      on assignment.loyalty_card_id = card.id and assignment.branch_id = target_branch_id
    where card.id = issued_record.loyalty_card_id and card.status = 'PUBLISHED';
  end if;
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
  perform pg_advisory_xact_lock(hashtextextended('swiftwallet:customer-balance:' || issued_record.customer_id::text, 0));
  select balance.* into balance_record from public.customer_loyalty_balances balance
  where balance.customer_id = issued_record.customer_id for update;
  if balance_record.id is null then
    insert into public.customer_loyalty_balances (tenant_id, customer_id)
    values (staff_record.tenant_id, issued_record.customer_id);
    select balance.* into balance_record from public.customer_loyalty_balances balance
    where balance.customer_id = issued_record.customer_id for update;
  end if;
  if program_record.rule_type = 'PER_PURCHASE' then
    calculated_stamps := case when target_amount_minor >= program_record.minimum_purchase_minor then program_record.stamps_per_purchase else 0 end;
    calculated_remainder := balance_record.remainder_minor;
  else
    calculated_stamps := floor((target_amount_minor + case when program_record.carry_remainder then balance_record.remainder_minor else 0 end) / program_record.amount_per_stamp_minor)::integer;
    calculated_remainder := case when program_record.carry_remainder then (target_amount_minor + balance_record.remainder_minor) % program_record.amount_per_stamp_minor else target_amount_minor % program_record.amount_per_stamp_minor end;
  end if;
  insert into public.purchases (
    tenant_id, customer_id, branch_id, staff_profile_id, ticket_number,
    amount_minor, latitude, longitude, rule_type, program_version,
    stamps_awarded, remainder_before_minor, remainder_after_minor,
    reward_cycle_goal, loyalty_card_id, program_id
  ) values (
    staff_record.tenant_id, issued_record.customer_id, target_branch_id,
    staff_record.id, btrim(target_ticket_number), target_amount_minor,
    target_latitude, target_longitude, program_record.rule_type,
    program_record.version, calculated_stamps, balance_record.remainder_minor,
    calculated_remainder, program_record.reward_stamp_goal,
    issued_record.loyalty_card_id, program_record.id
  ) returning id into purchase_id_value;
  select * into tier_result from app.apply_reward_tiers(
    issued_record.customer_id, program_record.id, balance_record.stamp_balance,
    calculated_stamps, purchase_id_value, null
  );
  update public.customer_loyalty_balances set remainder_minor = calculated_remainder,
    updated_at = now() where customer_id = issued_record.customer_id;
  update public.purchases set reward_cycles_completed = tier_result.cycles_completed
    where id = purchase_id_value;
  update public.rewards set loyalty_card_id = issued_record.loyalty_card_id
    where source_purchase_id = purchase_id_value;
  insert into public.stamp_ledger (
    tenant_id, customer_id, entry_type, purchase_id, stamps_delta,
    balance_after, remainder_after_minor, created_by_staff_id, loyalty_card_id
  ) values (
    staff_record.tenant_id, issued_record.customer_id, 'PURCHASE', purchase_id_value,
    calculated_stamps, tier_result.final_balance, calculated_remainder,
    staff_record.id, issued_record.loyalty_card_id
  );
  return query select 'CONFIRMED', purchase_id_value, calculated_stamps,
    tier_result.rewards_generated, calculated_remainder;
exception when unique_violation then
  return query select 'DUPLICATE_TICKET', null::uuid, 0, 0, 0::bigint;
end;
$$;

drop function if exists app.get_public_web_card(text);
create function app.get_public_web_card(target_card_token text)
returns table (
  tenant_name text, branding_mode public.branding_mode, logo_url text,
  primary_color text, secondary_color text, customer_name text,
  program_name text, program_status text, stamp_balance integer,
  reward_goal integer, terms_and_conditions text,
  reward_tiers jsonb, available_rewards jsonb
)
language sql security definer set search_path = public, app, auth
as $$
  select tenant.name, tenant.branding_mode,
    coalesce(card.logo_image_url, tenant.logo_url),
    card.foreground_color, card.background_color,
    customer.full_name, program.name, program.status::text,
    coalesce(balance.stamp_balance, 0), program.reward_stamp_goal,
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

create or replace function app.public_apple_wallet_is_enabled(target_card_token text)
returns boolean
language sql stable security definer set search_path = public, app, auth
as $$
  select coalesce((select coalesce(card.wallet_enabled, design.apple_enabled, false)
    from public.customer_cards issued
    join public.customers customer on customer.id = issued.customer_id
    join public.tenants tenant on tenant.id = issued.tenant_id
    left join public.loyalty_cards card on card.id = issued.loyalty_card_id
    left join public.tenant_wallet_designs design on design.tenant_id = issued.tenant_id
    where issued.public_token = target_card_token and issued.status = 'ACTIVE'
      and customer.status = 'ACTIVE' and tenant.status = 'ACTIVE'
      and (issued.loyalty_card_id is null or card.status = 'PUBLISHED')), false);
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
  issued_record record;
  program_record record;
  balance_record record;
  projected_balance integer;
  final_balance integer;
  adjustment_id_value uuid;
  tier_result record;
  generated_count integer := 0;
  completed_count integer := 0;
  reward_index integer;
begin
  if target_stamps_delta = 0 or nullif(btrim(target_reason), '') is null then
    return 'INVALID';
  end if;
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp join public.tenants tenant on tenant.id = sp.tenant_id
  where sp.id = auth.uid() and sp.status = 'ACTIVE' and tenant.status = 'ACTIVE';
  select issued.loyalty_card_id, customer.tenant_id,
         coalesce(issued.status, 'ACTIVE'::public.customer_card_status) as status
  into issued_record
  from public.customers customer
  left join public.customer_cards issued on issued.customer_id = customer.id
  where customer.id = target_customer_id and customer.status = 'ACTIVE';
  if issued_record.loyalty_card_id is null then
    select program.* into program_record
    from public.loyalty_programs program
    where program.tenant_id = staff_record.tenant_id
    order by (program.status = 'ACTIVE') desc, program.updated_at desc, program.id limit 1;
  else
    select program.* into program_record
    from public.loyalty_cards card
    join public.loyalty_programs program on program.id = card.program_id
    join public.loyalty_card_branches assignment
      on assignment.loyalty_card_id = card.id and assignment.branch_id = target_branch_id
    where card.id = issued_record.loyalty_card_id and card.status = 'PUBLISHED';
  end if;
  if staff_record.id is null or issued_record.status <> 'ACTIVE'
    or issued_record.tenant_id is distinct from staff_record.tenant_id
    or program_record.id is null
    or not (
      app.current_staff_can_manage_tenant(staff_record.tenant_id)
      or (app.current_staff_role() = 'MANAGER' and app.current_staff_can_access_branch(target_branch_id))
    ) then
    return 'UNAVAILABLE';
  end if;
  if target_stamps_delta > 0 and program_record.status <> 'ACTIVE' then
    return 'PROGRAM_PAUSED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('swiftwallet:customer-balance:' || target_customer_id::text, 0));
  select balance.* into balance_record from public.customer_loyalty_balances balance
  where balance.customer_id = target_customer_id for update;
  if balance_record.id is null then
    insert into public.customer_loyalty_balances (tenant_id, customer_id)
    values (staff_record.tenant_id, target_customer_id);
    select balance.* into balance_record from public.customer_loyalty_balances balance
    where balance.customer_id = target_customer_id for update;
  end if;
  projected_balance := balance_record.stamp_balance + target_stamps_delta;
  if projected_balance < 0 then return 'NEGATIVE_BALANCE'; end if;
  adjustment_id_value := extensions.gen_random_uuid();
  insert into public.stamp_adjustments (
    id, tenant_id, customer_id, branch_id, staff_profile_id,
    stamps_delta, reason, loyalty_card_id, reward_cycle_goal
  ) values (
    adjustment_id_value, staff_record.tenant_id, target_customer_id,
    target_branch_id, staff_record.id, target_stamps_delta, btrim(target_reason),
    issued_record.loyalty_card_id,
    case when target_stamps_delta > 0 then program_record.reward_stamp_goal else null end
  );
  if target_stamps_delta > 0 then
    if exists (select 1 from public.loyalty_reward_tiers tier
      where tier.program_id = program_record.id and tier.active) then
      select * into tier_result from app.apply_reward_tiers(
        target_customer_id, program_record.id, balance_record.stamp_balance,
        target_stamps_delta, null, adjustment_id_value
      );
      final_balance := tier_result.final_balance;
      generated_count := tier_result.rewards_generated;
      completed_count := tier_result.cycles_completed;
    else
      completed_count := floor(projected_balance::numeric / program_record.reward_stamp_goal)::integer;
      generated_count := completed_count;
      final_balance := projected_balance % program_record.reward_stamp_goal;
      update public.customer_loyalty_balances
      set stamp_balance = final_balance,
          completed_cycles = completed_cycles + completed_count,
          updated_at = now()
      where customer_id = target_customer_id;
      if completed_count > 0 then
        for reward_index in 1..completed_count loop
          insert into public.rewards (
            tenant_id, customer_id, program_id, source_adjustment_id,
            name, description, expires_at, loyalty_card_id
          ) values (
            staff_record.tenant_id, target_customer_id, program_record.id,
            adjustment_id_value, program_record.reward_name,
            program_record.reward_description,
            case when program_record.reward_expiration_days is null then null
              else now() + make_interval(days => program_record.reward_expiration_days) end,
            issued_record.loyalty_card_id
          );
        end loop;
      end if;
    end if;
    update public.stamp_adjustments
    set rewards_generated = generated_count,
        reward_cycles_completed = completed_count
    where id = adjustment_id_value;
    update public.rewards set loyalty_card_id = issued_record.loyalty_card_id
    where source_adjustment_id = adjustment_id_value;
  else
    final_balance := projected_balance;
    update public.customer_loyalty_balances set stamp_balance = final_balance,
      updated_at = now() where customer_id = target_customer_id;
  end if;
  insert into public.stamp_ledger (
    tenant_id, customer_id, entry_type, stamps_delta, balance_after,
    remainder_after_minor, reason, created_by_staff_id, loyalty_card_id
  ) values (
    staff_record.tenant_id, target_customer_id, 'ADJUSTMENT', target_stamps_delta,
    final_balance, balance_record.remainder_minor, btrim(target_reason),
    staff_record.id, issued_record.loyalty_card_id
  );
  return 'ADJUSTED';
end;
$$;

revoke all on function app.register_public_customer(text, uuid, text, text, text, date, boolean) from public, authenticated;
grant execute on function app.register_public_customer(text, uuid, text, text, text, date, boolean) to anon;
revoke all on function app.register_employee_customer(uuid, uuid, text, text, text, date, boolean) from public, anon;
grant execute on function app.register_employee_customer(uuid, uuid, text, text, text, date, boolean) to authenticated;
revoke all on function app.get_staff_registration_scopes() from public, anon;
grant execute on function app.get_staff_registration_scopes() to authenticated;
revoke all on function app.resolve_staff_card_scan(text) from public, anon;
grant execute on function app.resolve_staff_card_scan(text) to authenticated;
revoke all on function app.preview_card_purchase(uuid, uuid, bigint) from public, anon;
revoke all on function app.confirm_card_purchase(uuid, uuid, text, bigint, numeric, numeric) from public, anon;
grant execute on function app.preview_card_purchase(uuid, uuid, bigint) to authenticated;
grant execute on function app.confirm_card_purchase(uuid, uuid, text, bigint, numeric, numeric) to authenticated;
revoke all on function app.adjust_customer_stamps(uuid, uuid, integer, text) from public, anon;
grant execute on function app.adjust_customer_stamps(uuid, uuid, integer, text) to authenticated;
revoke all on function app.get_public_web_card(text) from public, authenticated;
grant execute on function app.get_public_web_card(text) to anon;
