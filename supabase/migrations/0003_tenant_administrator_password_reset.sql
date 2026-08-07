-- Marks a tenant Administrator as requiring a password change before Auth reset.

create or replace function app.mark_tenant_administrator_password_reset(
  target_tenant_id uuid,
  target_administrator_id uuid,
  requested_by_superadmin_id uuid
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
    where sp.id = requested_by_superadmin_id
      and sp.role = 'SUPERADMIN'
      and sp.status = 'ACTIVE'
      and sp.tenant_id is null
  ) then
    raise exception 'an active Superadmin is required'
      using errcode = '42501';
  end if;

  perform 1
  from public.staff_profiles sp
  where sp.id = target_administrator_id
    and sp.tenant_id = target_tenant_id
    and sp.role = 'ADMIN'
    and sp.status in ('ACTIVE', 'PASSWORD_RESET_REQUIRED')
  for update;

  if not found then
    raise exception 'tenant Administrator does not exist'
      using errcode = '23503';
  end if;

  update public.staff_profiles
  set
    status = 'PASSWORD_RESET_REQUIRED',
    temporary_password_expires_at = null
  where id = target_administrator_id;

  return target_administrator_id;
end;
$$;

revoke all on function app.mark_tenant_administrator_password_reset(
  uuid,
  uuid,
  uuid
) from public, anon, authenticated;

grant execute on function app.mark_tenant_administrator_password_reset(
  uuid,
  uuid,
  uuid
) to service_role;
