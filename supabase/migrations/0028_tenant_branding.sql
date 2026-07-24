-- Phase 7: Superadmin tenant branding controls.

create or replace function public.update_tenant_branding(
  target_tenant_id uuid,
  target_branding_mode public.branding_mode,
  target_logo_url text,
  target_banner_url text,
  target_primary_color text,
  target_secondary_color text
)
returns public.tenants
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare updated_tenant public.tenants;
begin
  if not app.is_superadmin() then raise exception 'superadmin required' using errcode = '42501'; end if;
  if target_primary_color !~ '^#[0-9A-Fa-f]{6}$' or target_secondary_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'invalid colors' using errcode = '22023'; end if;
  update public.tenants set branding_mode = target_branding_mode, logo_url = nullif(target_logo_url, ''), banner_url = nullif(target_banner_url, ''), primary_color = upper(target_primary_color), secondary_color = upper(target_secondary_color), updated_at = now() where id = target_tenant_id returning * into updated_tenant;
  if not found then raise exception 'tenant not found' using errcode = 'P0002'; end if;
  insert into public.audit_logs (tenant_id, actor_staff_id, action, entity_type, entity_id, metadata)
    values (updated_tenant.id, auth.uid(), 'TENANT_BRANDING_UPDATED', 'tenants', updated_tenant.id, jsonb_build_object('branding_mode', updated_tenant.branding_mode, 'primary_color', updated_tenant.primary_color, 'secondary_color', updated_tenant.secondary_color));
  return updated_tenant;
end;
$$;

revoke all on function public.update_tenant_branding(uuid, public.branding_mode, text, text, text, text) from public, anon, authenticated;
grant execute on function public.update_tenant_branding(uuid, public.branding_mode, text, text, text, text) to authenticated;
