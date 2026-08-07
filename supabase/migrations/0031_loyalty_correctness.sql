-- Close loyalty correctness gaps for reward expiration, manual adjustments,
-- goal changes, and reward-state audit metadata.

alter table public.stamp_adjustments
  add column rewards_generated integer not null default 0,
  add constraint stamp_adjustments_rewards_generated_nonnegative
    check (rewards_generated >= 0);

alter table public.rewards
  add column source_adjustment_id uuid references public.stamp_adjustments(id) on delete restrict,
  add column cancelled_at timestamptz,
  add column cancelled_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  add column cancellation_reason text;

update public.rewards r
set cancelled_at = coalesce(p.cancelled_at, r.created_at),
    cancelled_by_staff_id = p.cancelled_by_staff_id,
    cancellation_reason = coalesce(
      nullif(btrim(p.cancellation_reason), ''),
      'Motivo histórico no disponible'
    )
from public.purchases p
where r.source_purchase_id = p.id
  and r.status = 'CANCELLED';

update public.rewards
set cancelled_at = coalesce(cancelled_at, created_at),
    cancellation_reason = coalesce(
      nullif(btrim(cancellation_reason), ''),
      'Motivo histórico no disponible'
    )
where status = 'CANCELLED'
  and (cancelled_at is null or nullif(btrim(cancellation_reason), '') is null);

alter table public.rewards
  add constraint rewards_single_generation_source check (
    num_nonnulls(source_purchase_id, source_adjustment_id) <= 1
  ),
  add constraint rewards_cancellation_consistency check (
    (
      status = 'CANCELLED'
      and cancelled_at is not null
      and nullif(btrim(cancellation_reason), '') is not null
    )
    or (
      status <> 'CANCELLED'
      and cancelled_at is null
      and cancelled_by_staff_id is null
      and cancellation_reason is null
    )
  );

create index rewards_source_adjustment_idx
  on public.rewards (source_adjustment_id)
  where source_adjustment_id is not null;

create index rewards_available_expiration_idx
  on public.rewards (tenant_id, expires_at)
  where status = 'AVAILABLE' and expires_at is not null;

alter type public.stamp_ledger_entry_type
  add value if not exists 'PROGRAM_CHANGE';

create or replace function app.audit_sensitive_change()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  actor_id uuid := auth.uid();
  tenant_value uuid;
  action_value text;
  entity_value uuid;
  metadata_value jsonb;
begin
  if tg_table_name = 'customers' then
    tenant_value := new.tenant_id;
    entity_value := new.id;
    action_value := case when tg_op = 'INSERT' then 'CUSTOMER_CREATED' else 'CUSTOMER_UPDATED' end;
    metadata_value := jsonb_build_object(
      'status', new.status,
      'registration_method', new.registration_method
    );
  elsif tg_table_name = 'purchases' then
    tenant_value := new.tenant_id;
    entity_value := new.id;
    action_value := case when tg_op = 'INSERT' then 'PURCHASE_CONFIRMED' else 'PURCHASE_CANCELLED' end;
    metadata_value := jsonb_build_object(
      'branch_id', new.branch_id,
      'amount_minor', new.amount_minor,
      'ticket_number', new.ticket_number,
      'reason', new.cancellation_reason
    );
  elsif tg_table_name = 'reward_redemptions' then
    tenant_value := new.tenant_id;
    entity_value := new.reward_id;
    action_value := case when tg_op = 'INSERT' then 'REWARD_REDEEMED' else 'REWARD_REDEMPTION_REVERSED' end;
    metadata_value := jsonb_build_object(
      'branch_id', new.branch_id,
      'redemption_id', new.id,
      'reason', new.reversal_reason
    );
  elsif tg_table_name = 'stamp_adjustments' then
    tenant_value := new.tenant_id;
    entity_value := new.id;
    action_value := 'STAMP_ADJUSTMENT';
    metadata_value := jsonb_build_object(
      'branch_id', new.branch_id,
      'stamps_delta', new.stamps_delta,
      'rewards_generated', new.rewards_generated,
      'reason', new.reason
    );
  elsif tg_table_name = 'rewards' then
    tenant_value := new.tenant_id;
    entity_value := new.id;
    if tg_op = 'INSERT' then
      action_value := 'REWARD_GENERATED';
      metadata_value := jsonb_build_object(
        'status', new.status,
        'source_purchase_id', new.source_purchase_id,
        'source_adjustment_id', new.source_adjustment_id,
        'expires_at', new.expires_at
      );
    else
      if old.status is not distinct from new.status then
        return new;
      end if;
      if new.status in ('REDEEMED', 'AVAILABLE') then
        -- Redemption and reversal have richer branch/reason audit rows from
        -- reward_redemptions, so do not duplicate those actions here.
        return new;
      end if;
      action_value := case new.status
        when 'CANCELLED' then 'REWARD_CANCELLED'
        when 'EXPIRED' then 'REWARD_EXPIRED'
      end;
      metadata_value := jsonb_build_object(
        'previous_status', old.status,
        'status', new.status,
        'reason', new.cancellation_reason,
        'expires_at', new.expires_at
      );
    end if;
  elsif tg_table_name = 'loyalty_programs' then
    tenant_value := new.tenant_id;
    entity_value := new.id;
    action_value := 'LOYALTY_PROGRAM_UPDATED';
    metadata_value := jsonb_build_object(
      'previous_status', old.status,
      'status', new.status,
      'previous_rule_type', old.rule_type,
      'rule_type', new.rule_type,
      'previous_reward_stamp_goal', old.reward_stamp_goal,
      'reward_stamp_goal', new.reward_stamp_goal,
      'previous_version', old.version,
      'version', new.version
    );
  else
    return new;
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
    tenant_value,
    actor_id,
    action_value,
    tg_table_name,
    entity_value,
    metadata_value
  );
  return new;
end;
$$;

drop trigger if exists loyalty_programs_audit_update on public.loyalty_programs;
create trigger loyalty_programs_audit_update
  after update on public.loyalty_programs
  for each row execute function app.audit_sensitive_change();

drop trigger if exists rewards_audit_insert on public.rewards;
create trigger rewards_audit_insert
  after insert on public.rewards
  for each row execute function app.audit_sensitive_change();

create or replace function app.expire_due_rewards()
returns integer
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_tenant_id uuid;
  expired_count integer;
begin
  select sp.tenant_id
    into staff_tenant_id
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
    and sp.status = 'ACTIVE'
    and t.status = 'ACTIVE';

  if staff_tenant_id is null then
    return 0;
  end if;

  update public.rewards
  set status = 'EXPIRED'
  where tenant_id = staff_tenant_id
    and status = 'AVAILABLE'
    and expires_at is not null
    and expires_at <= now();

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

revoke all on function app.expire_due_rewards() from public, anon;
grant execute on function app.expire_due_rewards() to authenticated;

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
  projected_stamps integer;
  generated_rewards integer := 0;
  purchase_id_value uuid;
  reward_index integer;
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

  select *
    into program_record
  from public.loyalty_programs
  where tenant_id = staff_record.tenant_id
    and status = 'ACTIVE';

  if not found then
    return query select 'PROGRAM_PAUSED', null::uuid, 0, 0, 0::bigint;
    return;
  end if;

  select *
    into balance_record
  from public.customer_loyalty_balances
  where customer_id = target_customer_id
  for update;

  if not found then
    insert into public.customer_loyalty_balances (tenant_id, customer_id)
    values (staff_record.tenant_id, target_customer_id);

    select *
      into balance_record
    from public.customer_loyalty_balances
    where customer_id = target_customer_id
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
      + case when program_record.carry_remainder then balance_record.remainder_minor else 0 end
    ) / program_record.amount_per_stamp_minor)::integer;
    calculated_remainder := case
      when program_record.carry_remainder then
        (target_amount_minor + balance_record.remainder_minor) % program_record.amount_per_stamp_minor
      else target_amount_minor % program_record.amount_per_stamp_minor
    end;
  end if;

  projected_stamps := balance_record.stamp_balance + calculated_stamps;
  generated_rewards := floor(projected_stamps / program_record.reward_stamp_goal)::integer;

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
    remainder_after_minor
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
    calculated_remainder
  )
  returning id into purchase_id_value;

  update public.customer_loyalty_balances
  set stamp_balance = projected_stamps % program_record.reward_stamp_goal,
      remainder_minor = calculated_remainder,
      updated_at = now()
  where customer_id = target_customer_id;

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
    projected_stamps % program_record.reward_stamp_goal,
    calculated_remainder,
    staff_record.id
  );

  if generated_rewards > 0 then
    for reward_index in 1..generated_rewards loop
      insert into public.rewards (
        tenant_id,
        customer_id,
        program_id,
        source_purchase_id,
        name,
        description,
        expires_at
      )
      values (
        staff_record.tenant_id,
        target_customer_id,
        program_record.id,
        purchase_id_value,
        program_record.reward_name,
        program_record.reward_description,
        case
          when program_record.reward_expiration_days is null then null
          else now() + make_interval(days => program_record.reward_expiration_days)
        end
      );
    end loop;
  end if;

  return query
  select 'CONFIRMED', purchase_id_value, calculated_stamps, generated_rewards, calculated_remainder;
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

  select *
    into balance_record
  from public.customer_loyalty_balances
  where customer_id = purchase_record.customer_id
  for update;

  previous_balance := balance_record.stamp_balance
    - purchase_record.stamps_awarded
    + (
      select coalesce(sum(lp.reward_stamp_goal), 0)
      from public.rewards r
      join public.loyalty_programs lp on lp.id = r.program_id
      where r.source_purchase_id = purchase_record.id
    );

  update public.customer_loyalty_balances
  set stamp_balance = previous_balance,
      remainder_minor = purchase_record.remainder_before_minor,
      updated_at = now()
  where customer_id = purchase_record.customer_id;

  update public.rewards
  set status = 'CANCELLED',
      cancelled_at = now(),
      cancelled_by_staff_id = staff_record.id,
      cancellation_reason = btrim(target_reason)
  where source_purchase_id = purchase_record.id
    and status = 'AVAILABLE';

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
  adjustment_id_value uuid;
  reward_index integer;
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
    select *
      into program_record
    from public.loyalty_programs
    where tenant_id = staff_record.tenant_id
      and status = 'ACTIVE';

    if not found then
      return 'PROGRAM_PAUSED';
    end if;
  end if;

  select *
    into balance_record
  from public.customer_loyalty_balances
  where customer_id = target_customer_id
  for update;

  if not found then
    insert into public.customer_loyalty_balances (tenant_id, customer_id)
    values (staff_record.tenant_id, target_customer_id);

    select *
      into balance_record
    from public.customer_loyalty_balances
    where customer_id = target_customer_id
    for update;
  end if;

  projected_balance := balance_record.stamp_balance + target_stamps_delta;
  if projected_balance < 0 then
    return 'NEGATIVE_BALANCE';
  end if;

  if target_stamps_delta > 0 then
    generated_rewards := floor(projected_balance / program_record.reward_stamp_goal)::integer;
    final_balance := projected_balance % program_record.reward_stamp_goal;
  else
    final_balance := projected_balance;
  end if;

  insert into public.stamp_adjustments (
    tenant_id,
    customer_id,
    branch_id,
    staff_profile_id,
    stamps_delta,
    rewards_generated,
    reason
  )
  values (
    staff_record.tenant_id,
    target_customer_id,
    target_branch_id,
    staff_record.id,
    target_stamps_delta,
    generated_rewards,
    btrim(target_reason)
  )
  returning id into adjustment_id_value;

  update public.customer_loyalty_balances
  set stamp_balance = final_balance,
      updated_at = now()
  where customer_id = target_customer_id;

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

  if generated_rewards > 0 then
    for reward_index in 1..generated_rewards loop
      insert into public.rewards (
        tenant_id,
        customer_id,
        program_id,
        source_adjustment_id,
        name,
        description,
        expires_at
      )
      values (
        staff_record.tenant_id,
        target_customer_id,
        program_record.id,
        adjustment_id_value,
        program_record.reward_name,
        program_record.reward_description,
        case
          when program_record.reward_expiration_days is null then null
          else now() + make_interval(days => program_record.reward_expiration_days)
        end
      );
    end loop;
  end if;

  return 'ADJUSTED';
end;
$$;

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
  program_record record;
  balance_customer_id uuid;
  balance_record record;
  generated_rewards integer;
  reward_index integer;
begin
  select lp.id, lp.tenant_id
    into program_record
  from public.loyalty_programs lp
  where lp.id = target_program_id;

  if not found or not app.current_staff_can_manage_tenant(program_record.tenant_id) then
    return 'UNAVAILABLE';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:tenant-program:' || program_record.tenant_id::text, 0)
  );

  update public.loyalty_programs
  set status = target_status,
      rule_type = target_rule_type,
      minimum_purchase_minor = target_minimum_purchase_minor,
      stamps_per_purchase = target_stamps_per_purchase,
      amount_per_stamp_minor = target_amount_per_stamp_minor,
      carry_remainder = target_carry_remainder,
      reward_stamp_goal = target_reward_stamp_goal,
      reward_name = btrim(target_reward_name),
      reward_description = target_reward_description,
      reward_expiration_days = target_reward_expiration_days,
      version = version + 1,
      updated_at = now()
  where id = target_program_id
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
          auth.uid()
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
  when check_violation or unique_violation then
    return 'INVALID';
end;
$$;

create or replace function app.redeem_reward(
  target_reward_id uuid,
  target_branch_id uuid,
  target_latitude numeric,
  target_longitude numeric
)
returns table (result text, redemption_id uuid)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  reward_record record;
  branch_record record;
  redemption_id_value uuid;
begin
  select sp.id, sp.tenant_id
    into staff_record
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
    and sp.status = 'ACTIVE'
    and t.status = 'ACTIVE';

  select b.id, b.tenant_id
    into branch_record
  from public.branches b
  where b.id = target_branch_id
    and b.status = 'ACTIVE';

  select r.*
    into reward_record
  from public.rewards r
  where r.id = target_reward_id
  for update;

  if staff_record.id is null
    or branch_record.tenant_id is distinct from staff_record.tenant_id
    or reward_record.tenant_id is distinct from staff_record.tenant_id
    or reward_record.status <> 'AVAILABLE'
    or not app.current_staff_can_access_branch(target_branch_id) then
    return query select 'UNAVAILABLE', null::uuid;
    return;
  end if;

  if reward_record.expires_at is not null and reward_record.expires_at <= now() then
    update public.rewards
    set status = 'EXPIRED'
    where id = reward_record.id;

    return query select 'EXPIRED', null::uuid;
    return;
  end if;

  insert into public.reward_redemptions (
    tenant_id,
    reward_id,
    customer_id,
    branch_id,
    staff_profile_id,
    latitude,
    longitude
  )
  values (
    staff_record.tenant_id,
    reward_record.id,
    reward_record.customer_id,
    target_branch_id,
    staff_record.id,
    target_latitude,
    target_longitude
  )
  returning id into redemption_id_value;

  update public.rewards
  set status = 'REDEEMED',
      redeemed_at = now()
  where id = reward_record.id;

  return query select 'REDEEMED', redemption_id_value;
exception
  when unique_violation then
    return query select 'UNAVAILABLE', null::uuid;
end;
$$;

create or replace function app.reverse_reward_redemption(
  target_redemption_id uuid,
  target_reason text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  redemption_record record;
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
    and t.status = 'ACTIVE';

  select rr.*, b.tenant_id as branch_tenant_id
    into redemption_record
  from public.reward_redemptions rr
  join public.branches b on b.id = rr.branch_id
  where rr.id = target_redemption_id
  for update;

  if staff_record.id is null
    or redemption_record.id is null
    or redemption_record.status <> 'COMPLETED'
    or redemption_record.branch_tenant_id is distinct from staff_record.tenant_id
    or not (
      app.current_staff_can_manage_tenant(redemption_record.tenant_id)
      or (
        app.current_staff_role() = 'MANAGER'
        and app.current_staff_can_access_branch(redemption_record.branch_id)
      )
    ) then
    return 'UNAVAILABLE';
  end if;

  select *
    into reward_record
  from public.rewards
  where id = redemption_record.reward_id
  for update;

  update public.rewards
  set status = case
        when reward_record.expires_at is not null and reward_record.expires_at <= now()
          then 'EXPIRED'::public.reward_status
        else 'AVAILABLE'::public.reward_status
      end,
      redeemed_at = null
  where id = redemption_record.reward_id;

  update public.reward_redemptions
  set status = 'REVERSED',
      reversed_at = now(),
      reversed_by_staff_id = staff_record.id,
      reversal_reason = btrim(target_reason)
  where id = target_redemption_id;

  return 'REVERSED';
end;
$$;

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
  stamp_balance integer,
  reward_goal integer,
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
    coalesce(clb.stamp_balance, 0),
    lp.reward_stamp_goal,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', r.name,
          'description', r.description,
          'expires_at', r.expires_at
        )
        order by r.created_at
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
  left join public.loyalty_programs lp
    on lp.tenant_id = c.tenant_id
    and lp.status = 'ACTIVE'
  where cc.public_token = target_card_token
    and cc.status = 'ACTIVE'
    and c.status = 'ACTIVE'
    and t.status = 'ACTIVE';
$$;

revoke all on function app.get_public_web_card(text) from public, authenticated;
grant execute on function app.get_public_web_card(text) to anon;

revoke all on function app.confirm_purchase(uuid, uuid, text, bigint, numeric, numeric) from public, anon;
revoke all on function app.cancel_purchase(uuid, text) from public, anon;
revoke all on function app.adjust_customer_stamps(uuid, uuid, integer, text) from public, anon;
revoke all on function app.update_loyalty_program(
  uuid,
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
revoke all on function app.redeem_reward(uuid, uuid, numeric, numeric) from public, anon;
revoke all on function app.reverse_reward_redemption(uuid, text) from public, anon;
revoke all on function app.cancel_reward(uuid, text) from public, anon;

grant execute on function app.confirm_purchase(uuid, uuid, text, bigint, numeric, numeric) to authenticated;
grant execute on function app.cancel_purchase(uuid, text) to authenticated;
grant execute on function app.adjust_customer_stamps(uuid, uuid, integer, text) to authenticated;
grant execute on function app.update_loyalty_program(
  uuid,
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
grant execute on function app.redeem_reward(uuid, uuid, numeric, numeric) to authenticated;
grant execute on function app.reverse_reward_redemption(uuid, text) to authenticated;
grant execute on function app.cancel_reward(uuid, text) to authenticated;
