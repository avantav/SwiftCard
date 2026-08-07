\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000061', 'shared-branch-a@swiftwallet.test'),
  ('00000000-0000-0000-0000-000000000062', 'scoped-employee-a@swiftwallet.test');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
select set_config('request.headers', '{}'::text, false);

do $$
declare
  result_value text;
  mode_value public.branch_employee_access_mode;
begin
  select app.configure_branch_shared_access(
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000061',
    'shared-branch-a@swiftwallet.test'
  ) into result_value;

  select employee_access_mode into mode_value
  from public.branches
  where id = '20000000-0000-0000-0000-000000000001';

  if result_value <> 'CONFIGURED'
    or mode_value <> 'SHARED_ACCOUNT_PIN' then
    raise exception 'Admin could not configure branch PIN access';
  end if;
end;
$$;

do $$
declare
  first_result text;
  duplicate_result text;
begin
  select app.create_branch_pin_operator(
    '20000000-0000-0000-0000-000000000001',
    'Mesero PIN',
    '123456'
  ) into first_result;

  select app.create_branch_pin_operator(
    '20000000-0000-0000-0000-000000000001',
    'PIN duplicado',
    '123456'
  ) into duplicate_result;

  if first_result <> 'CREATED' or duplicate_result <> 'DUPLICATE_PIN' then
    raise exception 'PIN creation or uniqueness failed';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);

do $$
declare
  visible_operators integer;
  forbidden_configuration text;
begin
  select count(*) into visible_operators
  from app.list_branch_pin_operators('20000000-0000-0000-0000-000000000001');

  select app.configure_branch_shared_access(
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000061',
    'shared-branch-a@swiftwallet.test'
  ) into forbidden_configuration;

  if visible_operators <> 1 or forbidden_configuration <> 'UNAVAILABLE' then
    raise exception 'Branch Administrator scope is incorrect';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000061', false);

do $$
declare
  visible_branches integer;
  scan_result record;
begin
  select count(*) into visible_branches from public.branches;
  select * into scan_result from app.resolve_staff_card_scan('missing-token');

  if visible_branches <> 0 or scan_result.result <> 'UNAVAILABLE' then
    raise exception 'Shared account bypassed PIN enforcement';
  end if;
end;
$$;

do $$
declare
  attempt integer;
  unlock_result record;
begin
  for attempt in 1..5 loop
    select * into unlock_result from app.unlock_branch_pin('000000');
  end loop;

  if unlock_result.result <> 'LOCKED' or unlock_result.locked_until is null then
    raise exception 'PIN lockout was not enforced after five attempts';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);
do $$
begin
  if app.clear_branch_pin_lockout('20000000-0000-0000-0000-000000000001') <> 'CLEARED' then
    raise exception 'Assigned Branch Administrator could not clear PIN lockout';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000061', false);
do $$
declare
  unlock_result record;
begin
  select * into unlock_result from app.unlock_branch_pin('123456');
  if unlock_result.result <> 'UNLOCKED' or unlock_result.session_token is null then
    raise exception 'Valid branch PIN did not unlock';
  end if;

  perform set_config(
    'request.headers',
    jsonb_build_object('x-swiftwallet-operator-session', unlock_result.session_token)::text,
    false
  );
end;
$$;

do $$
declare
  visible_branches integer;
  registration_result record;
  operator_id_value uuid;
  customer_operator_id uuid;
begin
  select count(*) into visible_branches from public.branches;
  select pin_operator_id into operator_id_value from app.current_pin_session();

  select * into registration_result
  from app.register_employee_customer(
    '20000000-0000-0000-0000-000000000001',
    'Cliente creado con PIN',
    '+5215551234567',
    '',
    null,
    true
  );

  select created_by_pin_operator_id into customer_operator_id
  from public.customers
  where normalized_phone = '+5215551234567';

  if visible_branches <> 1
    or registration_result.result <> 'CREATED'
    or operator_id_value is null
    or customer_operator_id is distinct from operator_id_value then
    raise exception 'Unlocked PIN session was not branch-scoped or attributed';
  end if;
end;
$$;

do $$
declare
  purchase_result record;
  purchase_operator_id uuid;
  ledger_operator_id uuid;
begin
  select * into purchase_result
  from app.confirm_purchase(
    (select id from public.customers where normalized_phone = '+5215551234567'),
    '20000000-0000-0000-0000-000000000001',
    'PIN-0035-001',
    1000,
    null,
    null
  );

  if purchase_result.result = 'CONFIRMED' then
    select pin_operator_id into purchase_operator_id
    from public.purchases where id = purchase_result.purchase_id;
    select created_by_pin_operator_id into ledger_operator_id
    from public.stamp_ledger where purchase_id = purchase_result.purchase_id;

    if purchase_operator_id is null or ledger_operator_id is distinct from purchase_operator_id then
      raise exception 'PIN purchase and ledger attribution failed';
    end if;
  elsif purchase_result.result <> 'PROGRAM_PAUSED' then
    raise exception 'PIN purchase failed authorization: %', purchase_result.result;
  end if;
end;
$$;

do $$
begin
  if not app.revoke_current_pin_session() then
    raise exception 'Current PIN session was not revoked';
  end if;
  if exists (select 1 from app.current_pin_session()) then
    raise exception 'Revoked PIN session remained active';
  end if;
end;
$$;

select set_config('request.headers', '{}'::text, false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare
  pin_actor_id uuid;
begin
  select actor_pin_operator_id into pin_actor_id
  from public.audit_logs
  where action = 'CUSTOMER_CREATED'
    and entity_id = (select id from public.customers where normalized_phone = '+5215551234567')
  order by created_at desc limit 1;

  if pin_actor_id is null then
    raise exception 'Audit log did not preserve PIN operator attribution';
  end if;
end;
$$;
