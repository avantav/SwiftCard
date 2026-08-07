-- Allow an authenticated tenant Administrator to create the tenant's first
-- loyalty program without accepting tenant authority from the caller.

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
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  program_id_value uuid;
  balance_customer_id uuid;
  balance_record record;
  generated_rewards integer;
  reward_index integer;
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
    or coalesce(length(btrim(target_reward_name)), 0) not between 1 and 120
    or target_reward_description is null
    or length(target_reward_description) > 500
    or target_minimum_purchase_minor is null
    or target_minimum_purchase_minor not between 0 and 9007199254740991
    or target_stamps_per_purchase is null
    or target_stamps_per_purchase not between 1 and 1000000
    or target_reward_stamp_goal is null
    or target_reward_stamp_goal not between 1 and 1000000
    or (
      target_reward_expiration_days is not null
      and target_reward_expiration_days not between 1 and 3650
    )
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

  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:tenant-program:' || staff_record.tenant_id::text, 0)
  );

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
    reward_expiration_days
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
    target_reward_stamp_goal,
    btrim(target_reward_name),
    btrim(target_reward_description),
    target_reward_expiration_days
  )
  returning id into program_id_value;

  if target_status = 'ACTIVE' then
    for balance_customer_id in
      select clb.customer_id
      from public.customer_loyalty_balances clb
      where clb.tenant_id = staff_record.tenant_id
        and clb.stamp_balance >= target_reward_stamp_goal
      order by clb.customer_id
    loop
      perform pg_advisory_xact_lock(
        hashtextextended('swiftwallet:customer-balance:' || balance_customer_id::text, 0)
      );

      select *
        into balance_record
      from public.customer_loyalty_balances
      where customer_id = balance_customer_id
      for update;

      generated_rewards := floor(
        balance_record.stamp_balance / target_reward_stamp_goal
      )::integer;

      if generated_rewards > 0 then
        update public.customer_loyalty_balances
        set stamp_balance = balance_record.stamp_balance % target_reward_stamp_goal,
            updated_at = now()
        where customer_id = balance_customer_id;

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
          balance_record.stamp_balance % target_reward_stamp_goal,
          balance_record.remainder_minor,
          'Conversión por configuración inicial',
          staff_record.id
        );

        for reward_index in 1..generated_rewards loop
          insert into public.rewards (
            tenant_id,
            customer_id,
            program_id,
            name,
            description,
            expires_at
          )
          values (
            staff_record.tenant_id,
            balance_customer_id,
            program_id_value,
            btrim(target_reward_name),
            btrim(target_reward_description),
            case
              when target_reward_expiration_days is null then null
              else now() + make_interval(days => target_reward_expiration_days)
            end
          );
        end loop;
      end if;
    end loop;
  end if;

  return query select 'CREATED', program_id_value;
exception
  when check_violation or not_null_violation or unique_violation then
    return query select 'INVALID', null::uuid;
end;
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
  staff_record record;
  program_record record;
  balance_customer_id uuid;
  balance_record record;
  generated_rewards integer;
  reward_index integer;
begin
  select sp.id, sp.tenant_id
    into staff_record
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
    and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE'
    and t.status = 'ACTIVE';

  select lp.id, lp.tenant_id
    into program_record
  from public.loyalty_programs lp
  where lp.id = target_program_id;

  if staff_record.id is null
    or program_record.id is null
    or program_record.tenant_id is distinct from staff_record.tenant_id then
    return 'UNAVAILABLE';
  end if;

  if target_status is null
    or target_rule_type is null
    or target_carry_remainder is null
    or coalesce(length(btrim(target_name)), 0) not between 1 and 120
    or coalesce(length(btrim(target_reward_name)), 0) not between 1 and 120
    or target_reward_description is null
    or length(target_reward_description) > 500
    or target_minimum_purchase_minor is null
    or target_minimum_purchase_minor not between 0 and 9007199254740991
    or target_stamps_per_purchase is null
    or target_stamps_per_purchase not between 1 and 1000000
    or target_reward_stamp_goal is null
    or target_reward_stamp_goal not between 1 and 1000000
    or (
      target_reward_expiration_days is not null
      and target_reward_expiration_days not between 1 and 3650
    )
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
    return 'INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:tenant-program:' || staff_record.tenant_id::text, 0)
  );

  update public.loyalty_programs
  set name = btrim(target_name),
      status = target_status,
      rule_type = target_rule_type,
      minimum_purchase_minor = target_minimum_purchase_minor,
      stamps_per_purchase = target_stamps_per_purchase,
      amount_per_stamp_minor = target_amount_per_stamp_minor,
      carry_remainder = target_carry_remainder,
      reward_stamp_goal = target_reward_stamp_goal,
      reward_name = btrim(target_reward_name),
      reward_description = btrim(target_reward_description),
      reward_expiration_days = target_reward_expiration_days,
      version = version + 1,
      updated_at = now()
  where id = target_program_id
    and tenant_id = staff_record.tenant_id
  returning * into program_record;

  if target_status = 'ACTIVE' then
    for balance_customer_id in
      select clb.customer_id
      from public.customer_loyalty_balances clb
      where clb.tenant_id = program_record.tenant_id
        and clb.stamp_balance >= target_reward_stamp_goal
      order by clb.customer_id
    loop
      perform pg_advisory_xact_lock(
        hashtextextended('swiftwallet:customer-balance:' || balance_customer_id::text, 0)
      );

      select *
        into balance_record
      from public.customer_loyalty_balances
      where customer_id = balance_customer_id
      for update;

      generated_rewards := floor(
        balance_record.stamp_balance / program_record.reward_stamp_goal
      )::integer;

      if generated_rewards > 0 then
        update public.customer_loyalty_balances
        set stamp_balance = balance_record.stamp_balance % program_record.reward_stamp_goal,
            updated_at = now()
        where customer_id = balance_customer_id;

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
          program_record.tenant_id,
          balance_customer_id,
          'PROGRAM_CHANGE',
          0,
          balance_record.stamp_balance % program_record.reward_stamp_goal,
          balance_record.remainder_minor,
          'Conversión por cambio de meta',
          staff_record.id
        );

        for reward_index in 1..generated_rewards loop
          insert into public.rewards (
            tenant_id,
            customer_id,
            program_id,
            name,
            description,
            expires_at
          )
          values (
            program_record.tenant_id,
            balance_customer_id,
            program_record.id,
            program_record.reward_name,
            program_record.reward_description,
            case
              when program_record.reward_expiration_days is null then null
              else now() + make_interval(days => program_record.reward_expiration_days)
            end
          );
        end loop;
      end if;
    end loop;
  end if;

  return 'UPDATED';
exception
  when check_violation or not_null_violation or unique_violation then
    return 'INVALID';
end;
$$;

-- Preserve the existing RPC signature while routing all callers through the
-- same validation, authorization, locking, conversion, and audit path.
create or replace function app.update_loyalty_program(
  target_program_id uuid,
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
  current_program_name text;
begin
  select lp.name
    into current_program_name
  from public.loyalty_programs lp
  where lp.id = target_program_id;

  return app.configure_loyalty_program(
    target_program_id,
    current_program_name,
    target_status,
    target_rule_type,
    target_minimum_purchase_minor,
    target_stamps_per_purchase,
    target_amount_per_stamp_minor,
    target_carry_remainder,
    target_reward_stamp_goal,
    target_reward_name,
    target_reward_description,
    target_reward_expiration_days
  );
end;
$$;

create or replace function app.audit_loyalty_program_creation()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  insert into public.audit_logs (
    tenant_id,
    actor_staff_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    new.tenant_id,
    auth.uid(),
    'LOYALTY_PROGRAM_CREATED',
    'loyalty_programs',
    new.id,
    jsonb_build_object(
      'name', new.name,
      'status', new.status,
      'rule_type', new.rule_type,
      'reward_stamp_goal', new.reward_stamp_goal,
      'reward_name', new.reward_name,
      'version', new.version
    )
  );
  return new;
end;
$$;

create or replace function app.audit_loyalty_program_configuration()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  insert into public.audit_logs (
    tenant_id,
    actor_staff_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    new.tenant_id,
    auth.uid(),
    'LOYALTY_PROGRAM_UPDATED',
    'loyalty_programs',
    new.id,
    jsonb_build_object(
      'previous_name', old.name,
      'name', new.name,
      'previous_status', old.status,
      'status', new.status,
      'previous_rule_type', old.rule_type,
      'rule_type', new.rule_type,
      'previous_minimum_purchase_minor', old.minimum_purchase_minor,
      'minimum_purchase_minor', new.minimum_purchase_minor,
      'previous_stamps_per_purchase', old.stamps_per_purchase,
      'stamps_per_purchase', new.stamps_per_purchase,
      'previous_amount_per_stamp_minor', old.amount_per_stamp_minor,
      'amount_per_stamp_minor', new.amount_per_stamp_minor,
      'previous_carry_remainder', old.carry_remainder,
      'carry_remainder', new.carry_remainder,
      'previous_reward_stamp_goal', old.reward_stamp_goal,
      'reward_stamp_goal', new.reward_stamp_goal,
      'previous_reward_name', old.reward_name,
      'reward_name', new.reward_name,
      'previous_reward_description', old.reward_description,
      'reward_description', new.reward_description,
      'previous_reward_expiration_days', old.reward_expiration_days,
      'reward_expiration_days', new.reward_expiration_days,
      'previous_version', old.version,
      'version', new.version
    )
  );
  return new;
end;
$$;

drop trigger if exists loyalty_programs_audit_insert on public.loyalty_programs;
create trigger loyalty_programs_audit_insert
  after insert on public.loyalty_programs
  for each row execute function app.audit_loyalty_program_creation();

drop trigger if exists loyalty_programs_audit_update on public.loyalty_programs;
create trigger loyalty_programs_audit_update
  after update on public.loyalty_programs
  for each row execute function app.audit_loyalty_program_configuration();

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
