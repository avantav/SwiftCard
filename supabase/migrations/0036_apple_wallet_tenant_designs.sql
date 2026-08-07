-- Phase 8: tenant-owned Apple Wallet design configuration.

create table public.tenant_wallet_designs (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  apple_enabled boolean not null default false,
  logo_text text not null,
  description text not null,
  background_color text not null,
  foreground_color text not null default '#FFFFFF',
  label_color text not null default '#FFFFFF',
  logo_image_url text,
  strip_image_url text,
  version integer not null default 1,
  updated_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_wallet_designs_logo_text_length
    check (length(btrim(logo_text)) between 1 and 60),
  constraint tenant_wallet_designs_description_length
    check (length(btrim(description)) between 1 and 120),
  constraint tenant_wallet_designs_background_color
    check (background_color ~ '^#[0-9A-F]{6}$'),
  constraint tenant_wallet_designs_foreground_color
    check (foreground_color ~ '^#[0-9A-F]{6}$'),
  constraint tenant_wallet_designs_label_color
    check (label_color ~ '^#[0-9A-F]{6}$'),
  constraint tenant_wallet_designs_logo_image_https
    check (logo_image_url is null or logo_image_url ~ '^https://'),
  constraint tenant_wallet_designs_strip_image_https
    check (strip_image_url is null or strip_image_url ~ '^https://'),
  constraint tenant_wallet_designs_version_positive check (version > 0)
);

create trigger tenant_wallet_designs_set_updated_at
  before update on public.tenant_wallet_designs
  for each row execute function app.set_updated_at();

alter table public.tenant_wallet_designs enable row level security;
alter table public.tenant_wallet_designs force row level security;

create policy tenant_wallet_designs_staff_read
  on public.tenant_wallet_designs
  for select
  to authenticated
  using (
    app.is_superadmin()
    or app.current_staff_can_manage_tenant(tenant_id)
  );

revoke all on public.tenant_wallet_designs from public, anon, authenticated;
grant select on public.tenant_wallet_designs to authenticated;

create function app.save_apple_wallet_design(
  target_apple_enabled boolean,
  target_logo_text text,
  target_description text,
  target_background_color text,
  target_foreground_color text,
  target_label_color text,
  target_logo_image_url text,
  target_strip_image_url text
)
returns table (result text, saved_version integer)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  saved_design public.tenant_wallet_designs;
  normalized_logo_url text := nullif(btrim(target_logo_image_url), '');
  normalized_strip_url text := nullif(btrim(target_strip_image_url), '');
begin
  select sp.id, sp.tenant_id
    into staff_record
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
    and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE'
    and t.status = 'ACTIVE';

  if staff_record.id is null or staff_record.tenant_id is null then
    return query select 'UNAVAILABLE', null::integer;
    return;
  end if;

  if target_apple_enabled is null
    or coalesce(length(btrim(target_logo_text)), 0) not between 1 and 60
    or coalesce(length(btrim(target_description)), 0) not between 1 and 120
    or upper(target_background_color) !~ '^#[0-9A-F]{6}$'
    or upper(target_foreground_color) !~ '^#[0-9A-F]{6}$'
    or upper(target_label_color) !~ '^#[0-9A-F]{6}$'
    or (normalized_logo_url is not null and normalized_logo_url !~ '^https://')
    or (normalized_strip_url is not null and normalized_strip_url !~ '^https://') then
    return query select 'INVALID', null::integer;
    return;
  end if;

  insert into public.tenant_wallet_designs (
    tenant_id,
    apple_enabled,
    logo_text,
    description,
    background_color,
    foreground_color,
    label_color,
    logo_image_url,
    strip_image_url,
    updated_by_staff_id
  )
  values (
    staff_record.tenant_id,
    target_apple_enabled,
    btrim(target_logo_text),
    btrim(target_description),
    upper(target_background_color),
    upper(target_foreground_color),
    upper(target_label_color),
    normalized_logo_url,
    normalized_strip_url,
    staff_record.id
  )
  on conflict (tenant_id) do update
    set apple_enabled = excluded.apple_enabled,
        logo_text = excluded.logo_text,
        description = excluded.description,
        background_color = excluded.background_color,
        foreground_color = excluded.foreground_color,
        label_color = excluded.label_color,
        logo_image_url = excluded.logo_image_url,
        strip_image_url = excluded.strip_image_url,
        version = public.tenant_wallet_designs.version + 1,
        updated_by_staff_id = excluded.updated_by_staff_id,
        updated_at = now()
  returning * into saved_design;

  insert into public.audit_logs (
    tenant_id,
    actor_staff_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    staff_record.tenant_id,
    staff_record.id,
    'APPLE_WALLET_DESIGN_UPDATED',
    'tenant_wallet_designs',
    staff_record.tenant_id,
    jsonb_build_object(
      'apple_enabled', saved_design.apple_enabled,
      'version', saved_design.version,
      'background_color', saved_design.background_color,
      'foreground_color', saved_design.foreground_color,
      'label_color', saved_design.label_color,
      'has_logo_image', saved_design.logo_image_url is not null,
      'has_strip_image', saved_design.strip_image_url is not null
    )
  );

  return query select 'SAVED', saved_design.version;
exception
  when check_violation or not_null_violation or invalid_text_representation then
    return query select 'INVALID', null::integer;
end;
$$;

create function app.public_apple_wallet_is_enabled(target_card_token text)
returns boolean
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select coalesce((
    select design.apple_enabled
    from public.customer_cards card
    join public.customers customer on customer.id = card.customer_id
    join public.tenants tenant on tenant.id = card.tenant_id
    join public.tenant_wallet_designs design on design.tenant_id = card.tenant_id
    where card.public_token = target_card_token
      and card.status = 'ACTIVE'
      and customer.status = 'ACTIVE'
      and tenant.status = 'ACTIVE'
  ), false);
$$;

revoke all on function app.save_apple_wallet_design(boolean, text, text, text, text, text, text, text)
  from public, anon;
grant execute on function app.save_apple_wallet_design(boolean, text, text, text, text, text, text, text)
  to authenticated;

revoke all on function app.public_apple_wallet_is_enabled(text)
  from public, authenticated;
grant execute on function app.public_apple_wallet_is_enabled(text) to anon;
