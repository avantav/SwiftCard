\set ON_ERROR_STOP on

select public_registration_token as branch_token
from public.branches
where id = '20000000-0000-0000-0000-000000000001'\gset

set role anon;

select * from app.register_public_customer(
  :'branch_token',
  'Public Customer',
  '+528133333333',
  'PUBLIC@EXAMPLE.TEST',
  null,
  true
);

reset role;

do $$
declare
  created_count integer;
begin
  select count(*) into created_count
  from public.customers
  where normalized_phone = '+528133333333';
  if created_count <> 1 then
    raise exception 'Public registration did not create exactly one customer';
  end if;
end;
$$;

do $$
declare
  duplicate_result text;
  duplicate_token text;
begin
  select result, card_token
    into duplicate_result, duplicate_token
  from app.register_public_customer(
    (select public_registration_token from public.branches
     where id = '20000000-0000-0000-0000-000000000001'),
    'Duplicate Name',
    '+528133333333',
    '',
    null,
    true
  );

  if duplicate_result <> 'DUPLICATE' or duplicate_token is not null then
    raise exception 'Duplicate response exposed a card or wrong result';
  end if;
end;
$$;

select * from app.register_public_customer(
  'invalid-branch-token',
  'Unavailable',
  '+528144444444',
  '',
  null,
  true
);

select 'Public registration assertions passed' as result;
