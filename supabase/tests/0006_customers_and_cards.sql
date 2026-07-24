\set ON_ERROR_STOP on

insert into public.customers (
  id, tenant_id, full_name, normalized_phone, privacy_consent,
  registration_method, source_branch_id
) values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Customer A', '+5218111111111', true, 'SELF_SERVICE',
    '20000000-0000-0000-0000-000000000001'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'Customer B', '+5218222222222', true, 'SELF_SERVICE',
    '20000000-0000-0000-0000-000000000003'
  );

insert into public.customer_cards (tenant_id, customer_id)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002'
  );

do $$
begin
  if (select length(public_token) from public.customer_cards
      where customer_id = '30000000-0000-0000-0000-000000000001') < 40 then
    raise exception 'Customer card token is too short';
  end if;

  if (select public_token from public.customer_cards
      where customer_id = '30000000-0000-0000-0000-000000000001') ~ '[^A-Za-z0-9_-]' then
    raise exception 'Customer card token contains unsafe characters';
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare
  visible_customers integer;
  visible_cards integer;
begin
  select count(*) into visible_customers from public.customers;
  select count(*) into visible_cards from public.customer_cards;
  if visible_customers <> 1 or visible_cards <> 1 then
    raise exception 'Tenant A expected one customer and card, got % and %', visible_customers, visible_cards;
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.customers (
      tenant_id, full_name, normalized_phone, privacy_consent,
      registration_method, source_branch_id
    ) values (
      '10000000-0000-0000-0000-000000000002', 'Forbidden', '+5218333333333',
      true, 'SELF_SERVICE', '20000000-0000-0000-0000-000000000003'
    );
    raise exception 'Tenant A inserted a Tenant B customer';
  exception when insufficient_privilege then null;
  end;
end;
$$;

do $$
begin
  begin
    insert into public.customer_cards (tenant_id, customer_id)
    values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002');
    raise exception 'Tenant A inserted a cross-tenant customer card';
  exception when check_violation then null;
  end;
end;
$$;

reset role;

set role anon;
do $$
begin
  begin
    perform 1 from public.customer_cards;
    raise exception 'Anonymous role queried customer cards';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select 'Customer and card assertions passed' as result;
