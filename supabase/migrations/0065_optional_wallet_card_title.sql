-- Allow a tenant to omit Apple Wallet logoText when the uploaded logo already
-- contains the business name. The title remains bounded when supplied.

alter table public.loyalty_cards
  drop constraint loyalty_cards_logo_text_length,
  add constraint loyalty_cards_logo_text_length
    check (length(btrim(logo_text)) between 0 and 60);

create or replace function app.save_loyalty_card_design(
  target_card_id uuid,
  target_wallet_enabled boolean,
  target_logo_text text,
  target_description text,
  target_background_color text,
  target_foreground_color text,
  target_label_color text,
  target_logo_image_url text,
  target_strip_image_url text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  normalized_logo_url text := nullif(btrim(target_logo_image_url), '');
  normalized_strip_url text := nullif(btrim(target_strip_image_url), '');
begin
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid() and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE' and t.status = 'ACTIVE';
  if staff_record.id is null or target_wallet_enabled is null
    or target_logo_text is null
    or length(btrim(target_logo_text)) > 60
    or coalesce(length(btrim(target_description)), 0) not between 1 and 120
    or upper(target_background_color) !~ '^#[0-9A-F]{6}$'
    or upper(target_foreground_color) !~ '^#[0-9A-F]{6}$'
    or upper(target_label_color) !~ '^#[0-9A-F]{6}$'
    or (normalized_logo_url is not null and normalized_logo_url !~ '^https://')
    or (normalized_strip_url is not null and normalized_strip_url !~ '^https://') then
    return 'INVALID';
  end if;

  update public.loyalty_cards
  set wallet_enabled = target_wallet_enabled,
      logo_text = btrim(target_logo_text), description = btrim(target_description),
      background_color = upper(target_background_color),
      foreground_color = upper(target_foreground_color),
      label_color = upper(target_label_color),
      logo_image_url = normalized_logo_url, strip_image_url = normalized_strip_url,
      design_completed = true, current_step = greatest(current_step, 3),
      updated_by_staff_id = staff_record.id
  where id = target_card_id and tenant_id = staff_record.tenant_id
    and status <> 'ARCHIVED';
  if not found then return 'UNAVAILABLE'; end if;
  return 'SAVED';
exception when check_violation then return 'INVALID';
end;
$$;

notify pgrst, 'reload schema';
