\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare
  update_result text;
begin
  select app.update_customer_profile(
    '30000000-0000-0000-0000-000000000001',
    'Updated Customer', '+528177777777', '', null, 'INACTIVE'
  ) into update_result;
  if update_result <> 'UPDATED' then
    raise exception 'Assigned Manager/Employee could not update customer';
  end if;
end;
$$;

do $$
declare
  update_result text;
begin
  select app.update_customer_profile(
    '30000000-0000-0000-0000-000000000002',
    'Cross Tenant', '+528188888888', '', null, 'ACTIVE'
  ) into update_result;
  if update_result <> 'UNAVAILABLE' then
    raise exception 'Cross-tenant customer update was accepted';
  end if;
end;
$$;

reset role;
select 'Customer profile management assertions passed' as result;
