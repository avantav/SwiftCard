-- Allow an active support session to update branch GPS policy without granting
-- the support actor unrestricted tenant-admin mutation authority.

create function app.support_set_tenant_location_validation_mode(
  target_tenant_id uuid,
  target_mode public.location_validation_mode,
  target_token_hash text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  session_record record;
  previous_mode public.location_validation_mode;
begin
  select session.id, session.tenant_id
    into session_record
  from public.support_impersonation_sessions session
  join public.staff_profiles actor on actor.id = session.superadmin_staff_id
  join public.tenants tenant on tenant.id = session.tenant_id
  where session.superadmin_staff_id = auth.uid()
    and session.tenant_id = target_tenant_id
    and session.token_hash = target_token_hash
    and session.ended_at is null
    and session.expires_at > now()
    and actor.role = 'SUPERADMIN'
    and actor.status = 'ACTIVE'
    and tenant.status = 'ACTIVE';

  if session_record.id is null or target_mode is null then
    return 'UNAVAILABLE';
  end if;

  select location_validation_mode into previous_mode
  from public.tenants
  where id = target_tenant_id
  for update;

  if target_mode = 'STRICT' and exists (
    select 1 from public.branches branch
    where branch.tenant_id = target_tenant_id
      and branch.status = 'ACTIVE'
      and (branch.latitude is null or branch.longitude is null)
  ) then
    return 'MISSING_COORDINATES';
  end if;

  if previous_mode = target_mode then return 'UNCHANGED'; end if;

  update public.tenants
  set location_validation_mode = target_mode
  where id = target_tenant_id;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    target_tenant_id,
    auth.uid(),
    'SUPPORT_TENANT_LOCATION_VALIDATION_UPDATED',
    'tenants',
    target_tenant_id,
    jsonb_build_object(
      'mode', 'SUPPORT',
      'previous_mode', previous_mode,
      'new_mode', target_mode,
      'support_session_id', session_record.id
    )
  );
  return 'UPDATED';
end;
$$;

revoke all on function app.support_set_tenant_location_validation_mode(uuid, public.location_validation_mode, text)
  from public, anon;
grant execute on function app.support_set_tenant_location_validation_mode(uuid, public.location_validation_mode, text)
  to authenticated;

notify pgrst, 'reload schema';
