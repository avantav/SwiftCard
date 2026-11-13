-- Fix (DEC-0070): a Superadmin marked PASSWORD_RESET_REQUIRED could not read
-- its own profile, so /login answered «account unavailable» instead of
-- sending it to /change-password. Tenant staff already had this access.
-- Only self-visibility changes; Superadmin powers (app.is_superadmin) still
-- require an ACTIVE profile.

create or replace function app.current_staff_can_view_self_profile()
returns boolean
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select coalesce(
    (sp.role = 'SUPERADMIN' and sp.status in ('ACTIVE', 'PASSWORD_RESET_REQUIRED'))
    or (
      sp.role <> 'SUPERADMIN'
      and sp.status in ('ACTIVE', 'PASSWORD_RESET_REQUIRED')
      and t.status = 'ACTIVE'
    ),
    false
  )
  from public.staff_profiles sp
  left join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
$$;
