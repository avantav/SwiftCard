\set ON_ERROR_STOP on

set role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000015',
  false
);

do $$
begin
  begin
    perform app.complete_required_password_change(
      '00000000-0000-0000-0000-000000000015'
    );
    raise exception 'Authenticated staff invoked the completion RPC directly';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

reset role;

set role service_role;

select app.complete_required_password_change(
  '00000000-0000-0000-0000-000000000015'
);

reset role;

do $$
declare
  profile_status public.staff_status;
  password_changed_at timestamptz;
begin
  select sp.status, sp.last_password_change_at
    into profile_status, password_changed_at
  from public.staff_profiles sp
  where sp.id = '00000000-0000-0000-0000-000000000015';

  if profile_status <> 'ACTIVE' or password_changed_at is null then
    raise exception
      'Required password change did not activate and timestamp the profile';
  end if;
end;
$$;

set role service_role;

do $$
begin
  begin
    perform app.complete_required_password_change(
      '00000000-0000-0000-0000-000000000015'
    );
    raise exception 'An active profile completed password change twice';
  exception
    when check_violation then
      null;
  end;
end;
$$;

reset role;

update public.staff_profiles
set status = 'PASSWORD_RESET_REQUIRED'
where id = '00000000-0000-0000-0000-000000000031';

set role service_role;

do $$
begin
  begin
    perform app.complete_required_password_change(
      '00000000-0000-0000-0000-000000000031'
    );
    raise exception 'A suspended tenant profile was activated';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

reset role;

do $$
declare
  profile_status public.staff_status;
begin
  select sp.status
    into profile_status
  from public.staff_profiles sp
  where sp.id = '00000000-0000-0000-0000-000000000031';

  if profile_status <> 'PASSWORD_RESET_REQUIRED' then
    raise exception 'Suspended tenant profile status changed to %', profile_status;
  end if;
end;
$$;

select 'Required password change assertions passed' as result;
