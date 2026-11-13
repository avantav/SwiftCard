-- «Olvidé mi contraseña» for tenant owners only (DEC-0063).
-- Only the general Administrator (role ADMIN) of an ACTIVE tenant can recover
-- a password by email. Every other role keeps the manual temporary-password
-- flow. Requests are rate limited by hashed email and hashed client address;
-- no plain email or IP is stored. Both functions are service-role only.

create table public.password_recovery_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  email_hash text not null,
  client_hash text not null,
  created_at timestamptz not null default now(),
  constraint password_recovery_requests_email_hash_valid check (email_hash ~ '^[0-9a-f]{64}$'),
  constraint password_recovery_requests_client_hash_valid check (client_hash ~ '^[0-9a-f]{64}$')
);

create index password_recovery_requests_email_idx
  on public.password_recovery_requests (email_hash, created_at desc);
create index password_recovery_requests_client_idx
  on public.password_recovery_requests (client_hash, created_at desc);

alter table public.password_recovery_requests enable row level security;
revoke all on public.password_recovery_requests from public, anon, authenticated;
grant select, insert, delete on public.password_recovery_requests to service_role;

-- Records the attempt and returns the owner's user id only when the request is
-- within limits (3 per email and 10 per client per hour) and the email belongs
-- to an ADMIN of an ACTIVE tenant whose profile is ACTIVE or awaiting a
-- password change. Otherwise returns null; callers answer neutrally either way.
create or replace function app.request_owner_password_recovery(
  target_email text,
  target_email_hash text,
  target_client_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  owner_id uuid;
begin
  if target_email_hash !~ '^[0-9a-f]{64}$' or target_client_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  delete from public.password_recovery_requests
  where created_at < now() - interval '1 day';

  if (
    select count(*) from public.password_recovery_requests
    where email_hash = target_email_hash and created_at > now() - interval '1 hour'
  ) >= 3 or (
    select count(*) from public.password_recovery_requests
    where client_hash = target_client_hash and created_at > now() - interval '1 hour'
  ) >= 10 then
    return null;
  end if;

  insert into public.password_recovery_requests (email_hash, client_hash)
  values (target_email_hash, target_client_hash);

  select sp.id
    into owner_id
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where lower(sp.email) = lower(btrim(target_email))
    and sp.role = 'ADMIN'
    and sp.status in ('ACTIVE', 'PASSWORD_RESET_REQUIRED')
    and t.status = 'ACTIVE'
  limit 1;

  return owner_id;
end;
$$;

revoke all on function app.request_owner_password_recovery(text, text, text)
from public, anon, authenticated;
grant execute on function app.request_owner_password_recovery(text, text, text)
to service_role;

-- Called after Auth accepted the recovery token and stored the new password.
-- Re-checks eligibility, clears any pending temporary password and audits.
create or replace function app.complete_owner_password_recovery(
  target_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  profile_record record;
begin
  select sp.id, sp.tenant_id, sp.status
    into profile_record
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = target_user_id
    and sp.role = 'ADMIN'
    and sp.status in ('ACTIVE', 'PASSWORD_RESET_REQUIRED')
    and t.status = 'ACTIVE'
  for update of sp;

  if not found then
    return false;
  end if;

  update public.staff_profiles
  set
    status = 'ACTIVE',
    temporary_password_expires_at = null,
    last_password_change_at = now()
  where id = target_user_id;

  insert into public.audit_logs (
    tenant_id,
    actor_staff_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    profile_record.tenant_id,
    target_user_id,
    'OWNER_PASSWORD_RECOVERED',
    'staff_profiles',
    target_user_id,
    jsonb_build_object('previous_status', profile_record.status::text, 'channel', 'EMAIL_LINK')
  );

  return true;
end;
$$;

revoke all on function app.complete_owner_password_recovery(uuid)
from public, anon, authenticated;
grant execute on function app.complete_owner_password_recovery(uuid)
to service_role;
