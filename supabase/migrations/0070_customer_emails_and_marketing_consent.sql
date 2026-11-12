-- Transactional customer emails (welcome, reward unlocked) and an optional,
-- separately recorded marketing consent for future email/WhatsApp campaigns.
-- See docs/CUSTOMER_EMAILS.md and DEC-0056.

-- 1. Marketing consent: explicit opt-in, never implied by the privacy notice.
alter table public.customers
  add column marketing_consent boolean not null default false,
  add column marketing_consent_at timestamptz,
  add column marketing_consent_source text;

alter table public.customers
  add constraint customers_marketing_consent_source_valid
    check (
      marketing_consent_source is null
      or marketing_consent_source in ('SELF_SERVICE', 'EMPLOYEE')
    ),
  add constraint customers_marketing_consent_recorded
    check (not marketing_consent or (marketing_consent_at is not null and marketing_consent_source is not null));

-- 2. Delivery log: one row per logical email, used for idempotency and
-- traceability. The recipient address is intentionally not stored.
create type public.customer_email_kind as enum ('WELCOME', 'REWARD_UNLOCKED');
create type public.customer_email_status as enum ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

create table public.customer_email_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete cascade,
  kind public.customer_email_kind not null,
  event_key text not null,
  status public.customer_email_status not null default 'PENDING',
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_email_deliveries_event_key_valid
    check (event_key ~ '^[a-z0-9_:-]{8,120}$'),
  constraint customer_email_deliveries_error_length
    check (last_error is null or length(last_error) <= 300),
  constraint customer_email_deliveries_unique_event unique (tenant_id, event_key)
);

create index customer_email_deliveries_customer_idx
  on public.customer_email_deliveries (customer_id, created_at desc);

create trigger customer_email_deliveries_set_updated_at
  before update on public.customer_email_deliveries
  for each row execute function app.set_updated_at();

alter table public.customer_email_deliveries enable row level security;
alter table public.customer_email_deliveries force row level security;

-- Only the server (service role) records deliveries; browsers have no access.
revoke all on public.customer_email_deliveries from public, anon, authenticated;
grant select, insert, update on public.customer_email_deliveries to service_role;

-- 3. Consent capture through the issued card capability. Anonymous callers
-- (public registration) record SELF_SERVICE; authenticated staff must have
-- access to the card's tenant and record EMPLOYEE.
create function app.set_card_marketing_consent(
  target_card_token text,
  target_consent boolean
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  actor_id uuid := auth.uid();
  card_customer_id uuid;
  card_tenant_id uuid;
  source_value text;
begin
  if target_card_token is null
    or target_card_token !~ '^[A-Za-z0-9_-]{40,256}$'
    or target_consent is null then
    return 'INVALID';
  end if;

  select cc.customer_id, cc.tenant_id
    into card_customer_id, card_tenant_id
  from public.customer_cards cc
  join public.customers c
    on c.id = cc.customer_id and c.tenant_id = cc.tenant_id
  join public.tenants t
    on t.id = cc.tenant_id
  where cc.public_token = target_card_token
    and cc.status = 'ACTIVE'
    and c.status = 'ACTIVE'
    and t.status = 'ACTIVE';

  if not found then
    return 'UNAVAILABLE';
  end if;

  if actor_id is null then
    source_value := 'SELF_SERVICE';
  else
    if not app.current_staff_can_access_tenant(card_tenant_id) then
      return 'UNAVAILABLE';
    end if;
    source_value := 'EMPLOYEE';
  end if;

  update public.customers
  set
    marketing_consent = target_consent,
    marketing_consent_at = now(),
    marketing_consent_source = source_value
  where id = card_customer_id
    and tenant_id = card_tenant_id
    and marketing_consent is distinct from target_consent;

  return 'UPDATED';
end;
$$;

revoke all on function app.set_card_marketing_consent(text, boolean)
  from public, anon, authenticated;
grant execute on function app.set_card_marketing_consent(text, boolean)
  to anon, authenticated;

notify pgrst, 'reload schema';
