\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare
  card_record record;
  result_value text;
begin
  select * into card_record
  from public.loyalty_cards
  where tenant_id = '10000000-0000-0000-0000-000000000001'
    and status = 'PUBLISHED'
  order by published_at
  limit 1;

  result_value := app.save_loyalty_card_design_v5(
    card_record.id, card_record.wallet_enabled, '', card_record.description,
    card_record.background_color, card_record.foreground_color,
    card_record.label_color, coalesce(card_record.logo_image_url, ''),
    coalesce(card_record.strip_image_url, ''),
    coalesce(card_record.notification_icon_url, ''),
    card_record.logo_scale_percent, card_record.logo_margin_x_percent,
    card_record.logo_margin_y_percent, card_record.strip_scale_percent,
    card_record.strip_margin_x_percent, card_record.strip_margin_y_percent,
    card_record.strip_dimming_enabled, card_record.strip_stamps_enabled
  );
  if result_value <> 'SAVED' then
    raise exception 'Tenant Admin could not save an empty optional card title';
  end if;

  if (select logo_text from public.loyalty_cards where id = card_record.id) <> '' then
    raise exception 'Empty card title was not persisted';
  end if;

  result_value := app.save_loyalty_card_design_v5(
    card_record.id, card_record.wallet_enabled, repeat('x', 61), card_record.description,
    card_record.background_color, card_record.foreground_color,
    card_record.label_color, coalesce(card_record.logo_image_url, ''),
    coalesce(card_record.strip_image_url, ''),
    coalesce(card_record.notification_icon_url, ''),
    card_record.logo_scale_percent, card_record.logo_margin_x_percent,
    card_record.logo_margin_y_percent, card_record.strip_scale_percent,
    card_record.strip_margin_x_percent, card_record.strip_margin_y_percent,
    card_record.strip_dimming_enabled, card_record.strip_stamps_enabled
  );
  if result_value <> 'INVALID' then
    raise exception 'Card title longer than 60 characters was accepted';
  end if;
end;
$$;

reset role;
