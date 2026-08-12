-- Convert current cyclic stamp balances when an existing program enters
-- lifetime points. This migration is additive because 0041 may already be
-- deployed. Programs changed after 0041 but before this migration are repaired
-- once during installation; future transitions are handled by the trigger.

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
  if target_tenant_id is null
    or target_program_id is null
    or target_previous_program_type is null
    or target_previous_program_type = 'LIFETIME_POINTS'
    or target_multiplier not between 1 and 1000000
    or not exists (
      select 1
      from public.loyalty_programs lp
      where lp.id = target_program_id
        and lp.tenant_id = target_tenant_id
    ) then
    raise check_violation using message = 'Invalid stamp-to-point conversion';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:tenant-program:' || target_tenant_id::text, 0)
  );

  if exists (
    select 1
    from public.customer_loyalty_balances clb
    where clb.tenant_id = target_tenant_id
      and clb.stamp_balance::bigint * target_multiplier > 2147483647
  ) then
    raise numeric_value_out_of_range using
      message = 'Converted point balance exceeds the supported integer range';
  end if;

  for balance_candidate in
    select clb.customer_id
    from public.customer_loyalty_balances clb
    where clb.tenant_id = target_tenant_id
      and (clb.stamp_balance <> 0 or clb.remainder_minor <> 0)
    order by clb.customer_id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(
        'swiftwallet:customer-balance:' || balance_candidate.customer_id::text,
        0
      )
    );

    select clb.*
      into balance_record
    from public.customer_loyalty_balances clb
    where clb.customer_id = balance_candidate.customer_id
      and clb.tenant_id = target_tenant_id
    for update;

    converted_balance := balance_record.stamp_balance * target_multiplier;

    update public.customer_loyalty_balances
    set stamp_balance = converted_balance,
        remainder_minor = 0,
        updated_at = now()
    where customer_id = balance_record.customer_id
      and tenant_id = target_tenant_id;

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
      target_tenant_id,
      balance_record.customer_id,
      'PROGRAM_CHANGE',
      converted_balance - balance_record.stamp_balance,
      converted_balance,
      0,
      'Conversión de sellos a puntos (1 sello = '
        || target_multiplier::text || ' puntos)',
      target_actor_staff_id
    );

    converted_customer_count := converted_customer_count + 1;
  end loop;

  insert into public.audit_logs (
    tenant_id,
    actor_staff_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    target_tenant_id,
    target_actor_staff_id,
    'LOYALTY_PROGRAM_BALANCES_CONVERTED',
    'loyalty_programs',
    target_program_id,
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
  uuid,
  uuid,
  public.loyalty_program_type,
  integer,
  uuid
) from public, anon, authenticated;

-- Repair a program that may have entered lifetime points after 0041 was
-- deployed and before this migration reached the same environment.
do $$
declare
  program_record record;
begin
  for program_record in
    select
      lp.id,
      lp.tenant_id,
      lp.import_stamp_to_point_multiplier,
      coalesce(
        (
          select (al.metadata->>'previous_program_type')::public.loyalty_program_type
          from public.audit_logs al
          where al.tenant_id = lp.tenant_id
            and al.entity_id = lp.id
            and al.action = 'LOYALTY_PROGRAM_TYPE_CHANGED'
            and al.metadata->>'new_program_type' = 'LIFETIME_POINTS'
          order by al.created_at desc, al.id desc
          limit 1
        ),
        'STAMPS_PER_PURCHASE'::public.loyalty_program_type
      ) as previous_program_type,
      (
        select al.actor_staff_id
        from public.audit_logs al
        where al.tenant_id = lp.tenant_id
          and al.entity_id = lp.id
          and al.action = 'LOYALTY_PROGRAM_TYPE_CHANGED'
          and al.metadata->>'new_program_type' = 'LIFETIME_POINTS'
        order by al.created_at desc, al.id desc
        limit 1
      ) as actor_staff_id
    from public.loyalty_programs lp
    where lp.program_type = 'LIFETIME_POINTS'
      and not exists (
        select 1
        from public.audit_logs al
        where al.tenant_id = lp.tenant_id
          and al.entity_id = lp.id
          and al.action = 'LOYALTY_PROGRAM_BALANCES_CONVERTED'
      )
    order by lp.tenant_id, lp.id
  loop
    perform app.convert_stamp_balances_to_lifetime_points(
      program_record.tenant_id,
      program_record.id,
      program_record.previous_program_type,
      program_record.import_stamp_to_point_multiplier,
      program_record.actor_staff_id
    );
  end loop;
end;
$$;

create or replace function app.convert_balances_on_lifetime_program_change()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  if old.program_type <> 'LIFETIME_POINTS'
    and new.program_type = 'LIFETIME_POINTS' then
    perform app.convert_stamp_balances_to_lifetime_points(
      new.tenant_id,
      new.id,
      old.program_type,
      new.import_stamp_to_point_multiplier,
      auth.uid()
    );
  end if;

  return new;
end;
$$;

revoke all on function app.convert_balances_on_lifetime_program_change()
  from public, anon, authenticated;

drop trigger if exists loyalty_program_convert_balances_to_points
  on public.loyalty_programs;

create trigger loyalty_program_convert_balances_to_points
  before update of program_type on public.loyalty_programs
  for each row
  execute function app.convert_balances_on_lifetime_program_change();
