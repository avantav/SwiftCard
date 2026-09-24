-- Per-card cyclic stamp artwork, row distribution and drag position.

create function app.valid_wallet_stamp_rows(value smallint[])
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select cardinality(value) <= 6
    and coalesce((select bool_and(item between 1 and 8) from unnest(value) item), true)
    and coalesce((select sum(item) <= 24 from unnest(value) item), true);
$$;

alter table public.loyalty_cards
  add column stamp_icon_url text,
  add column stamp_empty_slots_enabled boolean not null default true,
  add column stamp_row_counts smallint[] not null default '{}'::smallint[],
  add column stamp_position_x_percent smallint not null default 50,
  add column stamp_position_y_percent smallint not null default 50,
  add constraint loyalty_cards_stamp_icon_https
    check (stamp_icon_url is null or stamp_icon_url ~ '^https://'),
  add constraint loyalty_cards_stamp_rows_valid
    check (app.valid_wallet_stamp_rows(stamp_row_counts)),
  add constraint loyalty_cards_stamp_position_x_valid
    check (stamp_position_x_percent between 0 and 100),
  add constraint loyalty_cards_stamp_position_y_valid
    check (stamp_position_y_percent between 0 and 100);

create function app.save_loyalty_card_design_v6(
  target_card_id uuid,
  target_wallet_enabled boolean,
  target_logo_text text,
  target_description text,
  target_background_color text,
  target_foreground_color text,
  target_label_color text,
  target_logo_image_url text,
  target_strip_image_url text,
  target_notification_icon_url text,
  target_logo_scale_percent integer,
  target_logo_margin_x_percent integer,
  target_logo_margin_y_percent integer,
  target_strip_scale_percent integer,
  target_strip_margin_x_percent integer,
  target_strip_margin_y_percent integer,
  target_strip_dimming_enabled boolean,
  target_strip_stamps_enabled boolean,
  target_stamp_icon_url text,
  target_stamp_empty_slots_enabled boolean,
  target_stamp_row_counts integer[],
  target_stamp_position_x_percent integer,
  target_stamp_position_y_percent integer
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  save_result text;
  normalized_stamp_icon_url text := nullif(btrim(target_stamp_icon_url), '');
  normalized_rows smallint[];
begin
  if (normalized_stamp_icon_url is not null and normalized_stamp_icon_url !~ '^https://')
    or target_stamp_empty_slots_enabled is null
    or cardinality(coalesce(target_stamp_row_counts, '{}'::integer[])) > 6
    or exists (
      select 1 from unnest(coalesce(target_stamp_row_counts, '{}'::integer[])) item
      where item not between 1 and 8
    )
    or coalesce((select sum(item) from unnest(coalesce(target_stamp_row_counts, '{}'::integer[])) item), 0) > 24
    or target_stamp_position_x_percent not between 0 and 100
    or target_stamp_position_y_percent not between 0 and 100 then
    return 'INVALID';
  end if;
  normalized_rows := coalesce(target_stamp_row_counts, '{}'::integer[])::smallint[];

  save_result := app.save_loyalty_card_design_v5(
    target_card_id, target_wallet_enabled, target_logo_text, target_description,
    target_background_color, target_foreground_color, target_label_color,
    target_logo_image_url, target_strip_image_url, target_notification_icon_url,
    target_logo_scale_percent, target_logo_margin_x_percent,
    target_logo_margin_y_percent, target_strip_scale_percent,
    target_strip_margin_x_percent, target_strip_margin_y_percent,
    target_strip_dimming_enabled, target_strip_stamps_enabled
  );
  if save_result <> 'SAVED' then return save_result; end if;

  update public.loyalty_cards card
  set stamp_icon_url = normalized_stamp_icon_url,
      stamp_empty_slots_enabled = target_stamp_empty_slots_enabled,
      stamp_row_counts = normalized_rows,
      stamp_position_x_percent = target_stamp_position_x_percent,
      stamp_position_y_percent = target_stamp_position_y_percent
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

revoke all on function app.save_loyalty_card_design_v6(
  uuid, boolean, text, text, text, text, text, text, text, text,
  integer, integer, integer, integer, integer, integer, boolean, boolean,
  text, boolean, integer[], integer, integer
) from public, anon;
grant execute on function app.save_loyalty_card_design_v6(
  uuid, boolean, text, text, text, text, text, text, text, text,
  integer, integer, integer, integer, integer, integer, boolean, boolean,
  text, boolean, integer[], integer, integer
) to authenticated;

alter policy wallet_assets_admin_insert on storage.objects
  with check (
    bucket_id = 'wallet-assets'
    and (storage.foldername(name))[1] = app.current_staff_tenant_id()::text
    and (storage.foldername(name))[2] = 'apple'
    and array_length(storage.foldername(name), 1) = 2
    and storage.filename(name) ~ '^(logo|strip|notification|stamp)-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(png|jpg|webp)$'
    and app.current_staff_can_manage_tenant(app.current_staff_tenant_id())
  );
alter policy wallet_assets_admin_update on storage.objects
  using (
    bucket_id = 'wallet-assets'
    and (storage.foldername(name))[1] = app.current_staff_tenant_id()::text
    and (storage.foldername(name))[2] = 'apple'
    and array_length(storage.foldername(name), 1) = 2
    and storage.filename(name) ~ '^(logo|strip|notification|stamp)-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(png|jpg|webp)$'
    and app.current_staff_can_manage_tenant(app.current_staff_tenant_id())
  )
  with check (
    bucket_id = 'wallet-assets'
    and (storage.foldername(name))[1] = app.current_staff_tenant_id()::text
    and (storage.foldername(name))[2] = 'apple'
    and array_length(storage.foldername(name), 1) = 2
    and storage.filename(name) ~ '^(logo|strip|notification|stamp)-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(png|jpg|webp)$'
    and app.current_staff_can_manage_tenant(app.current_staff_tenant_id())
  );
alter policy wallet_assets_admin_delete on storage.objects
  using (
    bucket_id = 'wallet-assets'
    and (storage.foldername(name))[1] = app.current_staff_tenant_id()::text
    and (storage.foldername(name))[2] = 'apple'
    and array_length(storage.foldername(name), 1) = 2
    and storage.filename(name) ~ '^(logo|strip|notification|stamp)-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(png|jpg|webp)$'
    and app.current_staff_can_manage_tenant(app.current_staff_tenant_id())
  );

drop trigger apple_wallet_loyalty_card_changed on public.loyalty_cards;
create trigger apple_wallet_loyalty_card_changed
  after update of status, wallet_enabled, logo_text, description,
    background_color, foreground_color, label_color, logo_image_url,
    strip_image_url, notification_icon_url, logo_scale_percent,
    logo_margin_x_percent, logo_margin_y_percent, strip_scale_percent,
    strip_margin_x_percent, strip_margin_y_percent, strip_dimming_enabled,
    strip_stamps_enabled, stamp_icon_url, stamp_empty_slots_enabled,
    stamp_row_counts, stamp_position_x_percent, stamp_position_y_percent
  on public.loyalty_cards
  for each row execute function app.queue_apple_wallet_card_row_change();

notify pgrst, 'reload schema';
