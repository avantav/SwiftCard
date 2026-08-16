-- Persist possession-based acceptance of the current program terms before a
-- customer can download the issued card into a wallet provider.

create table public.customer_card_terms_acceptances (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_card_id uuid not null references public.customer_cards(id) on delete restrict,
  loyalty_card_id uuid not null references public.loyalty_cards(id) on delete restrict,
  program_id uuid not null references public.loyalty_programs(id) on delete restrict,
  program_version integer not null,
  terms_snapshot text not null,
  accepted_at timestamptz not null default now(),
  constraint customer_card_terms_version_positive check (program_version > 0),
  constraint customer_card_terms_snapshot_present check (length(btrim(terms_snapshot)) >= 10),
  constraint customer_card_terms_current_version_unique unique (
    customer_card_id,
    program_id,
    program_version
  )
);

create index customer_card_terms_acceptances_tenant_idx
  on public.customer_card_terms_acceptances (tenant_id, accepted_at desc);

create function app.enforce_customer_card_terms_scope()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  issued_record record;
  card_record record;
begin
  select issued.tenant_id, issued.loyalty_card_id
    into issued_record
  from public.customer_cards issued
  where issued.id = new.customer_card_id;

  select card.tenant_id, card.program_id
    into card_record
  from public.loyalty_cards card
  where card.id = new.loyalty_card_id;

  if issued_record.tenant_id is distinct from new.tenant_id
    or issued_record.loyalty_card_id is distinct from new.loyalty_card_id
    or card_record.tenant_id is distinct from new.tenant_id
    or card_record.program_id is distinct from new.program_id then
    raise check_violation using message = 'Card terms acceptance scope mismatch';
  end if;

  return new;
end;
$$;

create trigger customer_card_terms_acceptances_scope
  before insert on public.customer_card_terms_acceptances
  for each row execute function app.enforce_customer_card_terms_scope();

alter table public.customer_card_terms_acceptances enable row level security;
alter table public.customer_card_terms_acceptances force row level security;

revoke all on public.customer_card_terms_acceptances from public, anon, authenticated;

create function app.public_card_terms_are_accepted(target_card_token text)
returns boolean
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select exists (
    select 1
    from public.customer_cards issued
    join public.customers customer
      on customer.id = issued.customer_id
      and customer.status = 'ACTIVE'
    join public.tenants tenant
      on tenant.id = issued.tenant_id
      and tenant.status = 'ACTIVE'
    join public.loyalty_cards card
      on card.id = issued.loyalty_card_id
      and card.status = 'PUBLISHED'
    join public.loyalty_programs program
      on program.id = card.program_id
    join public.customer_card_terms_acceptances acceptance
      on acceptance.customer_card_id = issued.id
      and acceptance.program_id = program.id
      and acceptance.program_version = program.version
    where issued.public_token = target_card_token
      and issued.status = 'ACTIVE'
  );
$$;

create function app.get_public_card_claim(target_card_token text)
returns table (
  tenant_name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  customer_name text,
  program_name text,
  program_version integer,
  terms_and_conditions text
)
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select
    tenant.name,
    coalesce(card.logo_image_url, tenant.logo_url),
    card.foreground_color,
    card.background_color,
    customer.full_name,
    program.name,
    program.version,
    program.terms_and_conditions
  from public.customer_cards issued
  join public.customers customer
    on customer.id = issued.customer_id
    and customer.status = 'ACTIVE'
  join public.tenants tenant
    on tenant.id = issued.tenant_id
    and tenant.status = 'ACTIVE'
  join public.loyalty_cards card
    on card.id = issued.loyalty_card_id
    and card.status = 'PUBLISHED'
  join public.loyalty_programs program
    on program.id = card.program_id
  where issued.public_token = target_card_token
    and issued.status = 'ACTIVE';
$$;

create function app.accept_public_card_terms(
  target_card_token text,
  target_program_version integer
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  card_record record;
begin
  select
    issued.id as customer_card_id,
    issued.tenant_id,
    card.id as loyalty_card_id,
    program.id as program_id,
    program.version as program_version,
    program.terms_and_conditions
    into card_record
  from public.customer_cards issued
  join public.customers customer
    on customer.id = issued.customer_id
    and customer.status = 'ACTIVE'
  join public.tenants tenant
    on tenant.id = issued.tenant_id
    and tenant.status = 'ACTIVE'
  join public.loyalty_cards card
    on card.id = issued.loyalty_card_id
    and card.status = 'PUBLISHED'
  join public.loyalty_programs program
    on program.id = card.program_id
  where issued.public_token = target_card_token
    and issued.status = 'ACTIVE'
    and program.version = target_program_version;

  if card_record.customer_card_id is null then
    return 'UNAVAILABLE';
  end if;

  insert into public.customer_card_terms_acceptances (
    tenant_id,
    customer_card_id,
    loyalty_card_id,
    program_id,
    program_version,
    terms_snapshot
  ) values (
    card_record.tenant_id,
    card_record.customer_card_id,
    card_record.loyalty_card_id,
    card_record.program_id,
    card_record.program_version,
    card_record.terms_and_conditions
  )
  on conflict (customer_card_id, program_id, program_version) do nothing;

  return 'ACCEPTED';
end;
$$;

revoke all on function app.enforce_customer_card_terms_scope() from public, anon, authenticated;
revoke all on function app.public_card_terms_are_accepted(text) from public, anon, authenticated;
revoke all on function app.get_public_card_claim(text) from public, anon, authenticated;
revoke all on function app.accept_public_card_terms(text, integer) from public, anon, authenticated;
grant execute on function app.public_card_terms_are_accepted(text) to anon, authenticated;
grant execute on function app.get_public_card_claim(text) to anon, authenticated;
grant execute on function app.accept_public_card_terms(text, integer) to anon, authenticated;
