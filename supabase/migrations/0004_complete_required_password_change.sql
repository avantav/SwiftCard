-- Activates a password-reset profile after the server changed its Auth password.

create or replace function app.complete_required_password_change(
  target_user_id uuid
)
returns public.staff_role
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  profile_role public.staff_role;
  profile_tenant_id uuid;
  tenant_is_active boolean;
begin
  select sp.role, sp.tenant_id
    into profile_role, profile_tenant_id
  from public.staff_profiles sp
  where sp.id = target_user_id
    and sp.status = 'PASSWORD_RESET_REQUIRED'
  for update;

  if not found then
    raise exception 'password change is not required for this profile'
      using errcode = '23514';
  end if;

  if profile_role <> 'SUPERADMIN' then
    select t.status = 'ACTIVE'
      into tenant_is_active
    from public.tenants t
    where t.id = profile_tenant_id;

    if not coalesce(tenant_is_active, false) then
      raise exception 'tenant is not active'
        using errcode = '42501';
    end if;
  end if;

  update public.staff_profiles
  set
    status = 'ACTIVE',
    temporary_password_expires_at = null,
    last_password_change_at = now()
  where id = target_user_id;

  return profile_role;
end;
$$;

revoke all on function app.complete_required_password_change(uuid)
from public, anon, authenticated;

grant execute on function app.complete_required_password_change(uuid)
to service_role;
