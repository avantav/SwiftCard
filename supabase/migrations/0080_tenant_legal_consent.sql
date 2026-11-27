-- Tenant legal identity and staff acceptance of the platform legal documents
-- (DEC-0072).
--
-- * Each tenant records the legal name (razón social or natural person) and
--   full domicile that appear as the data controller and program operator in
--   the terms and privacy notice shown to its customers.
-- * Every tenant staff member accepts the current version of the platform
--   Terms and Privacy Notice before using /admin or /app. The Admin general
--   accepts on behalf of the business and must complete the legal identity
--   first. On shared branch devices the acceptance belongs to the unlocked
--   PIN operator, the person actually using the app.
-- * Acceptances are append-only evidence; tenant legal data changes only
--   through audited RPCs. The required version is passed by server code from
--   `LEGAL_VERSION` (src/lib/legal/company.ts).

alter table public.tenants
  add column legal_name text,
  add column legal_address text,
  add column legal_contact_email text,
  add column legal_updated_at timestamptz,
  add constraint tenants_legal_name_length check (
    legal_name is null or length(btrim(legal_name)) between 2 and 200
  ),
  add constraint tenants_legal_address_length check (
    legal_address is null or length(btrim(legal_address)) between 10 and 400
  ),
  add constraint tenants_legal_contact_email_format check (
    legal_contact_email is null
    or (length(legal_contact_email) <= 254 and legal_contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  );

create table public.staff_legal_acceptances (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  pin_operator_id uuid references public.branch_pin_operators(id) on delete cascade,
  acceptance_kind text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  constraint staff_legal_acceptances_kind check (acceptance_kind in ('BUSINESS', 'USER')),
  constraint staff_legal_acceptances_version_format check (
    length(version) between 1 and 20 and version ~ '^[0-9]+(\.[0-9]+)*$'
  )
);

create unique index staff_legal_acceptances_subject_version_idx
  on public.staff_legal_acceptances (
    staff_profile_id,
    coalesce(pin_operator_id, '00000000-0000-0000-0000-000000000000'::uuid),
    version
  );
create index staff_legal_acceptances_tenant_idx
  on public.staff_legal_acceptances (tenant_id, accepted_at desc);

create or replace function app.prevent_staff_legal_acceptance_mutation()
returns trigger language plpgsql
as $$
begin
  raise exception 'legal acceptances are append-only' using errcode = '42501';
end;
$$;

create trigger staff_legal_acceptances_no_update
  before update on public.staff_legal_acceptances
  for each row execute function app.prevent_staff_legal_acceptance_mutation();

alter table public.staff_legal_acceptances enable row level security;
alter table public.staff_legal_acceptances force row level security;
revoke all on public.staff_legal_acceptances from public, anon, authenticated;

-- Resolves who is accepting: the active tenant staff profile and, on shared
-- branch accounts, the unlocked PIN operator. Shared accounts without an
-- unlocked operator return no row (the unlock screen comes first).
create or replace function app.current_legal_subject()
returns table (
  staff_profile_id uuid,
  tenant_id uuid,
  role public.staff_role,
  pin_operator_id uuid
)
language plpgsql
stable
security definer
set search_path = public, app, auth, extensions
as $$
declare
  profile record;
  operator_id uuid;
begin
  select sp.id, sp.tenant_id, sp.role, sp.account_kind
    into profile
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id and t.status = 'ACTIVE'
  where sp.id = auth.uid()
    and sp.status = 'ACTIVE'
    and sp.role <> 'SUPERADMIN';

  if profile.id is null then
    return;
  end if;

  if profile.account_kind = 'BRANCH_SHARED' then
    select session.pin_operator_id into operator_id from app.current_pin_session() session limit 1;
    if operator_id is null then
      return;
    end if;
  end if;

  return query select profile.id, profile.tenant_id, profile.role, operator_id;
end;
$$;

create or replace function app.get_my_legal_status(required_version text)
returns table (
  acceptance_required boolean,
  company_info_required boolean,
  can_edit_company boolean,
  tenant_name text,
  legal_name text,
  legal_address text,
  legal_contact_email text,
  contact_email text
)
language plpgsql
stable
security definer
set search_path = public, app, auth, extensions
as $$
declare
  subject record;
  tenant record;
  accepted boolean;
begin
  if required_version is null or required_version !~ '^[0-9]+(\.[0-9]+)*$' then
    raise exception 'legal_version_invalid' using errcode = '22023';
  end if;

  select * into subject from app.current_legal_subject() limit 1;
  if subject.staff_profile_id is null then
    return;
  end if;

  select t.name, t.legal_name, t.legal_address, t.legal_contact_email, t.contact_email
    into tenant
  from public.tenants t
  where t.id = subject.tenant_id;

  select exists (
    select 1 from public.staff_legal_acceptances a
    where a.staff_profile_id = subject.staff_profile_id
      and a.pin_operator_id is not distinct from subject.pin_operator_id
      and a.version = required_version
  ) into accepted;

  return query select
    not accepted,
    subject.role = 'ADMIN' and (tenant.legal_name is null or tenant.legal_address is null),
    subject.role = 'ADMIN',
    tenant.name,
    tenant.legal_name,
    tenant.legal_address,
    tenant.legal_contact_email,
    tenant.contact_email;
end;
$$;

-- Admin general only. Null arguments keep the stored value so a version
-- re-acceptance does not force retyping; the result must be complete.
create or replace function app.update_tenant_legal_profile(
  target_legal_name text,
  target_legal_address text,
  target_legal_contact_email text
)
returns void
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  subject record;
  next_name text;
  next_address text;
  next_email text;
begin
  select * into subject from app.current_legal_subject() limit 1;
  if subject.staff_profile_id is null or subject.role <> 'ADMIN' or subject.pin_operator_id is not null then
    raise exception 'legal_profile_forbidden' using errcode = '42501';
  end if;

  select
    coalesce(nullif(btrim(target_legal_name), ''), t.legal_name),
    coalesce(nullif(btrim(target_legal_address), ''), t.legal_address),
    case when target_legal_contact_email is null then t.legal_contact_email
      else nullif(lower(btrim(target_legal_contact_email)), '') end
    into next_name, next_address, next_email
  from public.tenants t
  where t.id = subject.tenant_id
  for update;

  if next_name is null or length(next_name) not between 2 and 200 then
    raise exception 'legal_name_invalid' using errcode = '22023';
  end if;
  if next_address is null or length(next_address) not between 10 and 400 then
    raise exception 'legal_address_invalid' using errcode = '22023';
  end if;
  if next_email is not null and (length(next_email) > 254 or next_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'legal_email_invalid' using errcode = '22023';
  end if;

  update public.tenants
  set legal_name = next_name,
      legal_address = next_address,
      legal_contact_email = next_email,
      legal_updated_at = now()
  where id = subject.tenant_id;

  insert into public.audit_logs (tenant_id, actor_staff_id, action, entity_type, entity_id, metadata)
  values (subject.tenant_id, subject.staff_profile_id, 'TENANT_LEGAL_PROFILE_UPDATED', 'tenants', subject.tenant_id,
    jsonb_build_object('legal_name', next_name, 'has_contact_email', next_email is not null));
end;
$$;

create or replace function app.accept_platform_legal_terms(required_version text)
returns void
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  subject record;
  kind text;
  inserted uuid;
begin
  if required_version is null or required_version !~ '^[0-9]+(\.[0-9]+)*$' or length(required_version) > 20 then
    raise exception 'legal_version_invalid' using errcode = '22023';
  end if;

  select * into subject from app.current_legal_subject() limit 1;
  if subject.staff_profile_id is null then
    raise exception 'legal_acceptance_forbidden' using errcode = '42501';
  end if;

  kind := case when subject.role = 'ADMIN' and subject.pin_operator_id is null then 'BUSINESS' else 'USER' end;

  -- The business cannot accept without its legal identity on record.
  if kind = 'BUSINESS' and exists (
    select 1 from public.tenants t
    where t.id = subject.tenant_id and (t.legal_name is null or t.legal_address is null)
  ) then
    raise exception 'legal_profile_incomplete' using errcode = '22023';
  end if;

  insert into public.staff_legal_acceptances (tenant_id, staff_profile_id, pin_operator_id, acceptance_kind, version)
  values (subject.tenant_id, subject.staff_profile_id, subject.pin_operator_id, kind, required_version)
  on conflict do nothing
  returning id into inserted;

  if inserted is not null then
    insert into public.audit_logs (tenant_id, actor_staff_id, action, entity_type, entity_id, metadata)
    values (subject.tenant_id, subject.staff_profile_id, 'PLATFORM_LEGAL_TERMS_ACCEPTED', 'staff_legal_acceptances', inserted,
      jsonb_build_object('version', required_version, 'kind', kind, 'pin_operator_id', subject.pin_operator_id));
  end if;
end;
$$;

-- Admin onboarding: legal identity and acceptance in one transaction.
create or replace function app.complete_admin_legal_onboarding(
  required_version text,
  target_legal_name text,
  target_legal_address text,
  target_legal_contact_email text
)
returns void
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  perform app.update_tenant_legal_profile(target_legal_name, target_legal_address, target_legal_contact_email);
  perform app.accept_platform_legal_terms(required_version);
end;
$$;

revoke all on function app.prevent_staff_legal_acceptance_mutation() from public, anon, authenticated;
revoke all on function app.current_legal_subject() from public, anon, authenticated;
revoke all on function app.get_my_legal_status(text) from public, anon;
revoke all on function app.update_tenant_legal_profile(text, text, text) from public, anon;
revoke all on function app.accept_platform_legal_terms(text) from public, anon;
revoke all on function app.complete_admin_legal_onboarding(text, text, text, text) from public, anon;
grant execute on function app.get_my_legal_status(text) to authenticated;
grant execute on function app.update_tenant_legal_profile(text, text, text) to authenticated;
grant execute on function app.accept_platform_legal_terms(text) to authenticated;
grant execute on function app.complete_admin_legal_onboarding(text, text, text, text) to authenticated;
