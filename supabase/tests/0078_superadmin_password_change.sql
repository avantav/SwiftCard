\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('78000000-0000-0000-0000-000000000001', 'superadmin-reset-78@swiftwallet.test');
insert into public.staff_profiles (id, tenant_id, email, full_name, role, status) values
  ('78000000-0000-0000-0000-000000000001', null, 'superadmin-reset-78@swiftwallet.test', 'Superadmin 78', 'SUPERADMIN', 'PASSWORD_RESET_REQUIRED');

set role authenticated;
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-000000000001', false);

do $$
begin
  -- The login can read the profile and route to /change-password.
  if (select status::text from public.staff_profiles where id = '78000000-0000-0000-0000-000000000001') is distinct from 'PASSWORD_RESET_REQUIRED' then
    raise exception 'Superadmin pending a password change cannot read its own profile';
  end if;
  -- ...but has no Superadmin powers until the change is completed.
  if app.is_superadmin() then
    raise exception 'Superadmin with a pending password change acts as Superadmin';
  end if;
  if (select count(*) from public.staff_profiles) <> 1 then
    raise exception 'Superadmin pending a password change can read other profiles';
  end if;
end;
$$;

reset role;
