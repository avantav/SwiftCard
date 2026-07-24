\set ON_ERROR_STOP on

update public.staff_profiles
set status = 'ACTIVE'
where id = '00000000-0000-0000-0000-000000000041';

set role service_role;

select app.mark_tenant_administrator_password_reset(
  '10000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000001'
);

reset role;

do $$
declare
  administrator_status public.staff_status;
begin
  select sp.status
    into administrator_status
  from public.staff_profiles sp
  where sp.id = '00000000-0000-0000-0000-000000000041';

  if administrator_status <> 'PASSWORD_RESET_REQUIRED' then
    raise exception
      'Reset Administrator expected PASSWORD_RESET_REQUIRED, got %',
      administrator_status;
  end if;
end;
$$;

set role service_role;

do $$
begin
  begin
    perform app.mark_tenant_administrator_password_reset(
      '10000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000041',
      '00000000-0000-0000-0000-000000000001'
    );

    raise exception 'Cross-tenant Administrator reset was accepted';
  exception
    when foreign_key_violation then
      null;
  end;
end;
$$;

do $$
begin
  begin
    perform app.mark_tenant_administrator_password_reset(
      '10000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000041',
      '00000000-0000-0000-0000-000000000011'
    );

    raise exception 'Tenant Admin reset another Administrator password';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

reset role;

update public.staff_profiles
set status = 'INACTIVE'
where id = '00000000-0000-0000-0000-000000000021';

set role service_role;

do $$
begin
  begin
    perform app.mark_tenant_administrator_password_reset(
      '10000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000021',
      '00000000-0000-0000-0000-000000000001'
    );

    raise exception 'Inactive Administrator password reset was accepted';
  exception
    when foreign_key_violation then
      null;
  end;
end;
$$;

reset role;

do $$
declare
  administrator_status public.staff_status;
begin
  select sp.status
    into administrator_status
  from public.staff_profiles sp
  where sp.id = '00000000-0000-0000-0000-000000000021';

  if administrator_status <> 'INACTIVE' then
    raise exception
      'Inactive Administrator status changed to %',
      administrator_status;
  end if;
end;
$$;

select 'Administrator password reset assertions passed' as result;
