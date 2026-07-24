-- Phase 8 foundation: provider-neutral wallet pass records.

create type public.wallet_provider as enum ('APPLE', 'GOOGLE');
create type public.wallet_pass_status as enum ('PENDING', 'ACTIVE', 'UPDATE_PENDING', 'REVOKED', 'FAILED');

create table public.wallet_passes (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  customer_card_id uuid not null references public.customer_cards(id) on delete restrict,
  provider public.wallet_provider not null,
  status public.wallet_pass_status not null default 'PENDING',
  serial_number text not null,
  external_pass_id text,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_passes_serial_not_blank check (length(btrim(serial_number)) > 0),
  constraint wallet_passes_error_only_failed check (last_error is null or status = 'FAILED')
);

create unique index wallet_passes_provider_card_idx on public.wallet_passes (provider, customer_card_id);
create unique index wallet_passes_provider_serial_idx on public.wallet_passes (provider, serial_number);
create index wallet_passes_tenant_idx on public.wallet_passes (tenant_id, created_at desc);

create trigger wallet_passes_set_updated_at before update on public.wallet_passes
  for each row execute function app.set_updated_at();

alter table public.wallet_passes enable row level security;
alter table public.wallet_passes force row level security;
create policy wallet_passes_staff_read on public.wallet_passes for select to authenticated
  using (app.is_superadmin() or app.current_staff_can_manage_tenant(tenant_id));
revoke all on public.wallet_passes from anon, authenticated;
grant select on public.wallet_passes to authenticated;
