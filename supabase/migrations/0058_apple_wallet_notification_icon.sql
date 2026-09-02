-- Per-card Apple Wallet notification artwork. The icon is independent from
-- the horizontal logo rendered on the pass and falls back to that logo when
-- it is not configured.

alter table public.loyalty_cards
  add column notification_icon_url text;

alter table public.loyalty_cards
  add constraint loyalty_cards_notification_icon_https
  check (notification_icon_url is null or notification_icon_url ~ '^https://');

create function app.save_loyalty_card_design_v2(
  target_card_id uuid,
  target_wallet_enabled boolean,
  target_logo_text text,
  target_description text,
  target_background_color text,
  target_foreground_color text,
  target_label_color text,
  target_logo_image_url text,
  target_strip_image_url text,
  target_notification_icon_url text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  save_result text;
  normalized_notification_icon_url text := nullif(btrim(target_notification_icon_url), '');
begin
  if normalized_notification_icon_url is not null
    and normalized_notification_icon_url !~ '^https://' then
    return 'INVALID';
  end if;

  save_result := app.save_loyalty_card_design(
    target_card_id,
    target_wallet_enabled,
    target_logo_text,
    target_description,
    target_background_color,
    target_foreground_color,
    target_label_color,
    target_logo_image_url,
    target_strip_image_url
  );
  if save_result <> 'SAVED' then
    return save_result;
  end if;

  update public.loyalty_cards card
  set notification_icon_url = normalized_notification_icon_url
  where card.id = target_card_id
    and card.tenant_id = (
      select staff.tenant_id
      from public.staff_profiles staff
      join public.tenants tenant on tenant.id = staff.tenant_id
      where staff.id = auth.uid()
        and staff.role = 'ADMIN'
        and staff.status = 'ACTIVE'
        and tenant.status = 'ACTIVE'
    );
  if not found then
    raise check_violation using message = 'Card is not available to this tenant Admin';
  end if;

  return 'SAVED';
exception when check_violation then
  return 'INVALID';
end;
$$;

revoke all on function app.save_loyalty_card_design_v2(
  uuid, boolean, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function app.save_loyalty_card_design_v2(
  uuid, boolean, text, text, text, text, text, text, text, text
) to authenticated;

alter policy wallet_assets_admin_insert on storage.objects
  with check (
    bucket_id = 'wallet-assets'
    and (storage.foldername(name))[1] = app.current_staff_tenant_id()::text
    and (storage.foldername(name))[2] = 'apple'
    and array_length(storage.foldername(name), 1) = 2
    and storage.filename(name) ~ '^(logo|strip|notification)-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(png|jpg|webp)$'
    and app.current_staff_can_manage_tenant(app.current_staff_tenant_id())
  );

alter policy wallet_assets_admin_update on storage.objects
  using (
    bucket_id = 'wallet-assets'
    and (storage.foldername(name))[1] = app.current_staff_tenant_id()::text
    and (storage.foldername(name))[2] = 'apple'
    and array_length(storage.foldername(name), 1) = 2
    and storage.filename(name) ~ '^(logo|strip|notification)-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(png|jpg|webp)$'
    and app.current_staff_can_manage_tenant(app.current_staff_tenant_id())
  )
  with check (
    bucket_id = 'wallet-assets'
    and (storage.foldername(name))[1] = app.current_staff_tenant_id()::text
    and (storage.foldername(name))[2] = 'apple'
    and array_length(storage.foldername(name), 1) = 2
    and storage.filename(name) ~ '^(logo|strip|notification)-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(png|jpg|webp)$'
    and app.current_staff_can_manage_tenant(app.current_staff_tenant_id())
  );

alter policy wallet_assets_admin_delete on storage.objects
  using (
    bucket_id = 'wallet-assets'
    and (storage.foldername(name))[1] = app.current_staff_tenant_id()::text
    and (storage.foldername(name))[2] = 'apple'
    and array_length(storage.foldername(name), 1) = 2
    and storage.filename(name) ~ '^(logo|strip|notification)-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(png|jpg|webp)$'
    and app.current_staff_can_manage_tenant(app.current_staff_tenant_id())
  );

drop trigger apple_wallet_loyalty_card_changed on public.loyalty_cards;
create trigger apple_wallet_loyalty_card_changed
  after update of
    status,
    wallet_enabled,
    logo_text,
    description,
    background_color,
    foreground_color,
    label_color,
    logo_image_url,
    strip_image_url,
    notification_icon_url
  on public.loyalty_cards
  for each row execute function app.queue_apple_wallet_card_row_change();

notify pgrst, 'reload schema';
