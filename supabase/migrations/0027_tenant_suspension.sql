-- Phase 7: explicit Superadmin tenant suspension and reactivation.

create or replace function public.set_tenant_status(target_tenant_id uuid, target_status public.tenant_status)
returns public.tenants
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare updated_tenant public.tenants;
begin
  if not app.is_superadmin() then raise exception 'superadmin required' using errcode = '42501'; end if;
  update public.tenants
    set status = target_status, updated_at = now()
    where id = target_tenant_id
    returning * into updated_tenant;
  if not found then raise exception 'tenant not found' using errcode = 'P0002'; end if;
  insert into public.audit_logs (tenant_id, actor_staff_id, action, entity_type, entity_id, metadata)
    values (updated_tenant.id, auth.uid(), case when target_status = 'SUSPENDED' then 'TENANT_SUSPENDED' else 'TENANT_REACTIVATED' end, 'tenants', updated_tenant.id, jsonb_build_object('status', target_status));
  return updated_tenant;
end;
$$;

revoke all on function public.set_tenant_status(uuid, public.tenant_status) from public, anon, authenticated;
grant execute on function public.set_tenant_status(uuid, public.tenant_status) to authenticated;
