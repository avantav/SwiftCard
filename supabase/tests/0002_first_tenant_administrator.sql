\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000041', 'first-admin-c@swiftwallet.test'),
  ('00000000-0000-0000-0000-000000000042', 'second-admin-c@swiftwallet.test'),
  ('00000000-0000-0000-0000-000000000043', 'unauthorized-admin@swiftwallet.test');

insert into public.tenants (id, name, status)
values ('10000000-0000-0000-0000-000000000004', 'Tenant C', 'ACTIVE');

set role service_role;

select app.create_first_tenant_administrator(
  '10000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000041',
  'FIRST-ADMIN-C@SWIFTWALLET.TEST',
  'First Admin C',
  '00000000-0000-0000-0000-000000000001'
);

reset role;

do $$
declare
  administrator_status public.staff_status;
  administrator_email text;
begin
  select sp.status, sp.email
    into administrator_status, administrator_email
  from public.staff_profiles sp
  where sp.id = '00000000-0000-0000-0000-000000000041';

  if administrator_status <> 'PASSWORD_RESET_REQUIRED' then
    raise exception
      'First Administrator expected PASSWORD_RESET_REQUIRED, got %',
      administrator_status;
  end if;

  if administrator_email <> 'first-admin-c@swiftwallet.test' then
    raise exception
      'First Administrator email was not normalized, got %',
      administrator_email;
  end if;
end;
$$;

set role service_role;

do $$
begin
  begin
    perform app.create_first_tenant_administrator(
      '10000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000042',
      'second-admin-c@swiftwallet.test',
      'Second Admin C',
      '00000000-0000-0000-0000-000000000001'
    );

    raise exception 'A second first Administrator was accepted';
  exception
    when unique_violation then
      null;
  end;
end;
$$;

do $$
begin
  begin
    perform app.create_first_tenant_administrator(
      '10000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000043',
      'unauthorized-admin@swiftwallet.test',
      'Unauthorized Admin',
      '00000000-0000-0000-0000-000000000011'
    );

    raise exception 'A tenant Admin created another first Administrator';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

reset role;

select 'First Administrator assertions passed' as result;
