\set ON_ERROR_STOP on

update public.staff_profiles
set status = 'ACTIVE'
where id = '00000000-0000-0000-0000-000000000021';

insert into public.customer_loyalty_balances (
  tenant_id,
  customer_id,
  stamp_balance
)
values (
  '10000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000002',
  21
)
on conflict (customer_id) do update
set stamp_balance = excluded.stamp_balance;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);

do $$
declare
  result_record record;
  tenant_program_count integer;
  balance_value integer;
begin
  select *
    into result_record
  from app.create_loyalty_program(
    'Invalid program',
    'PAUSED',
    'PER_PURCHASE',
    0,
    1,
    null,
    false,
    10,
    '',
    '',
    null
  );

  select count(*)
    into tenant_program_count
  from public.loyalty_programs
  where tenant_id = '10000000-0000-0000-0000-000000000002';

  select stamp_balance
    into balance_value
  from public.customer_loyalty_balances
  where customer_id = '30000000-0000-0000-0000-000000000002';

  if result_record.result <> 'INVALID'
    or tenant_program_count <> 0
    or balance_value <> 21 then
    raise exception 'Invalid first program was persisted';
  end if;
end;
$$;

do $$
declare
  result_record record;
  program_record record;
  audit_count integer;
  balance_value integer;
  reward_count integer;
  program_change_ledger_count integer;
begin
  select *
    into result_record
  from app.create_loyalty_program(
    'Programa Tenant B',
    'ACTIVE',
    'PER_AMOUNT',
    0,
    1,
    2500,
    true,
    8,
    'Bebida gratis',
    'Una bebida de cortesía',
    30
  );

  select *
    into program_record
  from public.loyalty_programs
  where id = result_record.program_id;

  select count(*)
    into audit_count
  from public.audit_logs
  where action = 'LOYALTY_PROGRAM_CREATED'
    and entity_id = result_record.program_id
    and actor_staff_id = '00000000-0000-0000-0000-000000000021';

  select stamp_balance
    into balance_value
  from public.customer_loyalty_balances
  where customer_id = '30000000-0000-0000-0000-000000000002';

  select count(*)
    into reward_count
  from public.rewards
  where customer_id = '30000000-0000-0000-0000-000000000002'
    and program_id = result_record.program_id;

  select count(*)
    into program_change_ledger_count
  from public.stamp_ledger
  where customer_id = '30000000-0000-0000-0000-000000000002'
    and entry_type = 'PROGRAM_CHANGE';

  if result_record.result <> 'CREATED'
    or result_record.program_id is null
    or program_record.tenant_id <> '10000000-0000-0000-0000-000000000002'
    or program_record.amount_per_stamp_minor <> 2500
    or audit_count <> 1
    or balance_value <> 5
    or reward_count <> 2
    or program_change_ledger_count <> 1 then
    raise exception 'Tenant Admin could not create an audited first program';
  end if;
end;
$$;

do $$
declare
  result_value text;
  program_record record;
  update_audit_count integer;
  update_audit_metadata jsonb;
begin
  select app.configure_loyalty_program(
    (
      select id
      from public.loyalty_programs
      where tenant_id = '10000000-0000-0000-0000-000000000002'
    ),
    'Programa Tenant B actualizado',
    'PAUSED',
    'PER_PURCHASE',
    1500,
    2,
    null,
    false,
    12,
    'Recompensa actualizada',
    'Descripción actualizada',
    null
  )
  into result_value;

  select *
    into program_record
  from public.loyalty_programs
  where tenant_id = '10000000-0000-0000-0000-000000000002';

  select count(*)
    into update_audit_count
  from public.audit_logs
  where action = 'LOYALTY_PROGRAM_UPDATED'
    and entity_id = program_record.id
    and actor_staff_id = '00000000-0000-0000-0000-000000000021';

  select metadata
    into update_audit_metadata
  from public.audit_logs
  where action = 'LOYALTY_PROGRAM_UPDATED'
    and entity_id = program_record.id
  order by created_at desc
  limit 1;

  if result_value <> 'UPDATED'
    or program_record.name <> 'Programa Tenant B actualizado'
    or program_record.status <> 'PAUSED'
    or program_record.minimum_purchase_minor <> 1500
    or program_record.stamps_per_purchase <> 2
    or program_record.version <> 2
    or update_audit_count <> 1
    or update_audit_metadata ->> 'previous_name' <> 'Programa Tenant B'
    or update_audit_metadata ->> 'name' <> 'Programa Tenant B actualizado' then
    raise exception 'Tenant Admin could not update and pause the program';
  end if;
end;
$$;

do $$
declare
  result_value text;
  program_record record;
  update_audit_count integer;
begin
  select app.update_loyalty_program(
    (
      select id
      from public.loyalty_programs
      where tenant_id = '10000000-0000-0000-0000-000000000002'
    ),
    'ACTIVE',
    'PER_AMOUNT',
    0,
    1,
    9007199254740992,
    true,
    8,
    'Bypass attempt',
    '',
    null
  )
  into result_value;

  select *
    into program_record
  from public.loyalty_programs
  where tenant_id = '10000000-0000-0000-0000-000000000002';

  select count(*)
    into update_audit_count
  from public.audit_logs
  where action = 'LOYALTY_PROGRAM_UPDATED'
    and entity_id = program_record.id;

  if result_value <> 'INVALID'
    or program_record.name <> 'Programa Tenant B actualizado'
    or program_record.status <> 'PAUSED'
    or program_record.version <> 2
    or update_audit_count <> 1 then
    raise exception 'Legacy program RPC bypassed backend validation';
  end if;
end;
$$;

do $$
declare
  result_record record;
begin
  select *
    into result_record
  from app.create_loyalty_program(
    'Duplicate program',
    'PAUSED',
    'PER_PURCHASE',
    1000,
    1,
    null,
    false,
    10,
    'Duplicate reward',
    '',
    null
  );

  if result_record.result <> 'ALREADY_EXISTS' then
    raise exception 'Second tenant program was accepted';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare
  result_value text;
begin
  select app.configure_loyalty_program(
    (
      select id
      from public.loyalty_programs
      where tenant_id = '10000000-0000-0000-0000-000000000002'
    ),
    'Cross-tenant update',
    'ACTIVE',
    'PER_PURCHASE',
    1000,
    1,
    null,
    false,
    10,
    'Cross-tenant reward',
    '',
    null
  )
  into result_value;

  if result_value <> 'UNAVAILABLE' then
    raise exception 'Tenant A Admin updated Tenant B program';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);

do $$
declare
  result_record record;
begin
  select *
    into result_record
  from app.create_loyalty_program(
    'Manager program',
    'ACTIVE',
    'PER_PURCHASE',
    1000,
    1,
    null,
    false,
    10,
    'Manager reward',
    '',
    null
  );

  if result_record.result <> 'UNAVAILABLE' then
    raise exception 'Manager created a loyalty program';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', false);

do $$
declare
  result_record record;
begin
  select *
    into result_record
  from app.create_loyalty_program(
    'Suspended program',
    'ACTIVE',
    'PER_PURCHASE',
    1000,
    1,
    null,
    false,
    10,
    'Suspended reward',
    '',
    null
  );

  if result_record.result <> 'UNAVAILABLE' then
    raise exception 'Suspended tenant Admin created a loyalty program';
  end if;
end;
$$;

reset role;

set role anon;

do $$
begin
  begin
    perform *
    from app.create_loyalty_program(
      'Anonymous program',
      'ACTIVE',
      'PER_PURCHASE',
      1000,
      1,
      null,
      false,
      10,
      'Anonymous reward',
      '',
      null
    );
    raise exception 'Anonymous role executed program creation';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

select 'Loyalty program creation assertions passed' as result;
