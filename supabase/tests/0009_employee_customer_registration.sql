\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', false);

do $$
declare
  created_result text;
  created_card_token text;
begin
  select result, card_token into created_result, created_card_token
  from app.register_employee_customer(
    '20000000-0000-0000-0000-000000000001',
    'Employee Customer', '+528155555555', 'employee@example.test', null, true
  );
  if created_result <> 'CREATED' or length(created_card_token) < 40 then
    raise exception 'Assigned employee registration did not create a card';
  end if;
end;
$$;

do $$
declare
  duplicate_result text;
  duplicate_card_token text;
begin
  select result, card_token into duplicate_result, duplicate_card_token
  from app.register_employee_customer(
    '20000000-0000-0000-0000-000000000001',
    'Duplicate Employee Customer', '+528155555555', '', null, true
  );
  if duplicate_result <> 'DUPLICATE' or duplicate_card_token is not null then
    raise exception 'Duplicate employee registration exposed a card or wrong result';
  end if;
end;
$$;

do $$
declare
  denied_result text;
begin
  select result into denied_result
  from app.register_employee_customer(
    '20000000-0000-0000-0000-000000000002',
    'Unassigned Customer', '+528166666666', '', null, true
  );
  if denied_result <> 'UNAVAILABLE' then
    raise exception 'Employee registered customer outside assigned active branch';
  end if;
end;
$$;

reset role;
select 'Employee registration assertions passed' as result;
