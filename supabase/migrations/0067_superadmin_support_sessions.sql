-- Audited, time-bounded, read-only support access for active Superadmins.

create table public.support_impersonation_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  superadmin_staff_id uuid not null references public.staff_profiles(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  token_hash text not null unique,
  reason text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  constraint support_impersonation_token_hash_valid
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint support_impersonation_reason_valid
    check (length(btrim(reason)) between 10 and 500),
  constraint support_impersonation_expiry_valid
    check (expires_at > created_at and expires_at <= created_at + interval '1 hour'),
  constraint support_impersonation_end_valid
    check (ended_at is null or ended_at >= created_at)
);

create index support_impersonation_actor_active_idx
  on public.support_impersonation_sessions (superadmin_staff_id, expires_at desc)
  where ended_at is null;

alter table public.support_impersonation_sessions enable row level security;
alter table public.support_impersonation_sessions force row level security;
revoke all on public.support_impersonation_sessions from public, anon, authenticated;

create function app.start_support_impersonation_session(
  target_tenant_id uuid,
  target_token_hash text,
  target_reason text
)
returns table (tenant_id uuid, tenant_name text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := btrim(target_reason);
  tenant_record record;
  session_expiry timestamptz := now() + interval '1 hour';
begin
  if actor_id is null
    or target_tenant_id is null
    or target_token_hash !~ '^[0-9a-f]{64}$'
    or length(normalized_reason) not between 10 and 500
    or not exists (
      select 1 from public.staff_profiles staff
      where staff.id = actor_id
        and staff.role = 'SUPERADMIN'
        and staff.status = 'ACTIVE'
    ) then
    raise insufficient_privilege using message = 'Support access is unavailable';
  end if;

  select tenant.id, tenant.name into tenant_record
  from public.tenants tenant
  where tenant.id = target_tenant_id
    and tenant.status = 'ACTIVE'
  for share;

  if tenant_record.id is null then
    raise check_violation using message = 'Only active tenants support access';
  end if;

  insert into public.support_impersonation_sessions (
    superadmin_staff_id,
    tenant_id,
    token_hash,
    reason,
    expires_at
  ) values (
    actor_id,
    tenant_record.id,
    target_token_hash,
    normalized_reason,
    session_expiry
  );

  insert into public.audit_logs (
    tenant_id,
    actor_staff_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    tenant_record.id,
    actor_id,
    'SUPPORT_IMPERSONATION_STARTED',
    'tenants',
    tenant_record.id,
    jsonb_build_object(
      'mode', 'READ_ONLY',
      'reason', normalized_reason,
      'expires_at', session_expiry
    )
  );

  return query select tenant_record.id, tenant_record.name, session_expiry;
end;
$$;

create function app.get_support_impersonation_session(target_token_hash text)
returns table (
  session_id uuid,
  tenant_id uuid,
  tenant_name text,
  tenant_status public.tenant_status,
  expires_at timestamptz,
  reason text
)
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select
    session.id,
    tenant.id,
    tenant.name,
    tenant.status,
    session.expires_at,
    session.reason
  from public.support_impersonation_sessions session
  join public.tenants tenant on tenant.id = session.tenant_id
  join public.staff_profiles actor on actor.id = session.superadmin_staff_id
  where session.superadmin_staff_id = auth.uid()
    and session.token_hash = target_token_hash
    and session.ended_at is null
    and session.expires_at > now()
    and actor.role = 'SUPERADMIN'
    and actor.status = 'ACTIVE'
    and tenant.status = 'ACTIVE'
  limit 1;
$$;

create function app.end_support_impersonation_session(target_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, app, auth
as $$
declare
  ended_session record;
begin
  update public.support_impersonation_sessions session
  set ended_at = now()
  where session.superadmin_staff_id = auth.uid()
    and session.token_hash = target_token_hash
    and session.ended_at is null
  returning session.id, session.tenant_id, session.reason, session.created_at,
    session.expires_at into ended_session;

  if ended_session.id is null then
    return false;
  end if;

  insert into public.audit_logs (
    tenant_id,
    actor_staff_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    ended_session.tenant_id,
    auth.uid(),
    'SUPPORT_IMPERSONATION_ENDED',
    'support_impersonation_sessions',
    ended_session.id,
    jsonb_build_object(
      'mode', 'READ_ONLY',
      'reason', ended_session.reason,
      'started_at', ended_session.created_at,
      'scheduled_expires_at', ended_session.expires_at,
      'ended_at', now()
    )
  );

  return true;
end;
$$;

revoke all on function app.start_support_impersonation_session(uuid, text, text)
  from public, anon;
revoke all on function app.get_support_impersonation_session(text)
  from public, anon;
revoke all on function app.end_support_impersonation_session(text)
  from public, anon;
grant execute on function app.start_support_impersonation_session(uuid, text, text)
  to authenticated;
grant execute on function app.get_support_impersonation_session(text)
  to authenticated;
grant execute on function app.end_support_impersonation_session(text)
  to authenticated;

notify pgrst, 'reload schema';
