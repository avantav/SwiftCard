-- Atomically creates the first tenant Administrator profile after Auth provisioning.

create or replace function app.create_first_tenant_administrator(
  target_tenant_id uuid,
  target_user_id uuid,
  target_email text,
  target_full_name text,
  created_by_superadmin_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  if not exists (
    select 1
    from public.staff_profiles sp
    where sp.id = created_by_superadmin_id
      and sp.role = 'SUPERADMIN'
      and sp.status = 'ACTIVE'
      and sp.tenant_id is null
  ) then
    raise exception 'an active Superadmin is required'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:first-admin:' || target_tenant_id::text, 0)
  );

  if not exists (
    select 1
    from public.tenants t
    where t.id = target_tenant_id
  ) then
    raise exception 'tenant does not exist'
      using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.staff_profiles sp
    where sp.tenant_id = target_tenant_id
      and sp.role = 'ADMIN'
  ) then
    raise exception 'first tenant Administrator already exists'
      using
        errcode = '23505',
        constraint = 'staff_profiles_first_tenant_administrator';
  end if;

  insert into public.staff_profiles (
    id,
    tenant_id,
    email,
    full_name,
    role,
    status,
    created_by
  ) values (
    target_user_id,
    target_tenant_id,
    lower(btrim(target_email)),
    btrim(target_full_name),
    'ADMIN',
    'PASSWORD_RESET_REQUIRED',
    created_by_superadmin_id
  );

  return target_user_id;
end;
$$;

revoke all on function app.create_first_tenant_administrator(
  uuid,
  uuid,
  text,
  text,
  uuid
) from public, anon, authenticated;

grant usage on schema app to service_role;

grant execute on function app.create_first_tenant_administrator(
  uuid,
  uuid,
  text,
  text,
  uuid
) to service_role;
