-- Allow tenant Admins to tune image scale and safe-area margins while keeping
-- the fixed Apple Wallet store-card dimensions authoritative.

alter table public.loyalty_cards
  add column logo_scale_percent smallint not null default 100,
  add column logo_margin_x_percent smallint not null default 0,
  add column logo_margin_y_percent smallint not null default 0,
  add column strip_scale_percent smallint not null default 100,
  add column strip_margin_x_percent smallint not null default 0,
  add column strip_margin_y_percent smallint not null default 0;

alter table public.loyalty_cards
  add constraint loyalty_cards_logo_scale_range
    check (logo_scale_percent between 50 and 100),
  add constraint loyalty_cards_logo_margin_x_range
    check (logo_margin_x_percent between 0 and 20),
  add constraint loyalty_cards_logo_margin_y_range
    check (logo_margin_y_percent between 0 and 20),
  add constraint loyalty_cards_strip_scale_range
    check (strip_scale_percent between 50 and 150),
  add constraint loyalty_cards_strip_margin_x_range
    check (strip_margin_x_percent between 0 and 20),
  add constraint loyalty_cards_strip_margin_y_range
    check (strip_margin_y_percent between 0 and 20);

create function app.save_loyalty_card_design_v3(
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
  target_strip_margin_y_percent integer
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  save_result text;
begin
  if target_logo_scale_percent not between 50 and 100
    or target_logo_margin_x_percent not between 0 and 20
    or target_logo_margin_y_percent not between 0 and 20
    or target_strip_scale_percent not between 50 and 150
    or target_strip_margin_x_percent not between 0 and 20
    or target_strip_margin_y_percent not between 0 and 20 then
    return 'INVALID';
  end if;

  save_result := app.save_loyalty_card_design_v2(
    target_card_id,
    target_wallet_enabled,
    target_logo_text,
    target_description,
    target_background_color,
    target_foreground_color,
    target_label_color,
    target_logo_image_url,
    target_strip_image_url,
    target_notification_icon_url
  );
  if save_result <> 'SAVED' then
    return save_result;
  end if;

  update public.loyalty_cards card
  set logo_scale_percent = target_logo_scale_percent,
      logo_margin_x_percent = target_logo_margin_x_percent,
      logo_margin_y_percent = target_logo_margin_y_percent,
      strip_scale_percent = target_strip_scale_percent,
      strip_margin_x_percent = target_strip_margin_x_percent,
      strip_margin_y_percent = target_strip_margin_y_percent
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

revoke all on function app.save_loyalty_card_design_v3(
  uuid, boolean, text, text, text, text, text, text, text, text,
  integer, integer, integer, integer, integer, integer
) from public, anon;
grant execute on function app.save_loyalty_card_design_v3(
  uuid, boolean, text, text, text, text, text, text, text, text,
  integer, integer, integer, integer, integer, integer
) to authenticated;

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
    notification_icon_url,
    logo_scale_percent,
    logo_margin_x_percent,
    logo_margin_y_percent,
    strip_scale_percent,
    strip_margin_x_percent,
    strip_margin_y_percent
  on public.loyalty_cards
  for each row execute function app.queue_apple_wallet_card_row_change();

notify pgrst, 'reload schema';
