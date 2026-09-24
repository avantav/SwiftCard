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

  result_value := app.save_loyalty_card_design_v6(
    card_record.id, card_record.wallet_enabled, card_record.logo_text,
    card_record.description, card_record.background_color,
    card_record.foreground_color, card_record.label_color,
    coalesce(card_record.logo_image_url, ''),
    coalesce(card_record.strip_image_url, ''),
    coalesce(card_record.notification_icon_url, ''),
    card_record.logo_scale_percent, card_record.logo_margin_x_percent,
    card_record.logo_margin_y_percent, card_record.strip_scale_percent,
    card_record.strip_margin_x_percent, card_record.strip_margin_y_percent,
    card_record.strip_dimming_enabled, true,
    'https://assets.example.com/custom-stamp.png', false,
    array[3, 3, 4], 32, 68
  );
  if result_value <> 'SAVED' then
    raise exception 'Tenant Admin could not save the stamp layout';
  end if;

  if not exists (
    select 1 from public.loyalty_cards
    where id = card_record.id
      and stamp_icon_url = 'https://assets.example.com/custom-stamp.png'
      and stamp_empty_slots_enabled = false
      and stamp_row_counts = array[3, 3, 4]::smallint[]
      and stamp_position_x_percent = 32
      and stamp_position_y_percent = 68
  ) then
    raise exception 'Stamp layout was not persisted';
  end if;

  result_value := app.save_loyalty_card_design_v6(
    card_record.id, card_record.wallet_enabled, card_record.logo_text,
    card_record.description, card_record.background_color,
    card_record.foreground_color, card_record.label_color,
    coalesce(card_record.logo_image_url, ''),
    coalesce(card_record.strip_image_url, ''),
    coalesce(card_record.notification_icon_url, ''),
    card_record.logo_scale_percent, card_record.logo_margin_x_percent,
    card_record.logo_margin_y_percent, card_record.strip_scale_percent,
    card_record.strip_margin_x_percent, card_record.strip_margin_y_percent,
    card_record.strip_dimming_enabled, true, '', true,
    array[9, 9, 9], 50, 50
  );
  if result_value <> 'INVALID' then
    raise exception 'Invalid stamp rows were accepted';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);

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

  result_value := app.save_loyalty_card_design_v6(
    card_record.id, card_record.wallet_enabled, card_record.logo_text,
    card_record.description, card_record.background_color,
    card_record.foreground_color, card_record.label_color,
    coalesce(card_record.logo_image_url, ''),
    coalesce(card_record.strip_image_url, ''),
    coalesce(card_record.notification_icon_url, ''),
    card_record.logo_scale_percent, card_record.logo_margin_x_percent,
    card_record.logo_margin_y_percent, card_record.strip_scale_percent,
    card_record.strip_margin_x_percent, card_record.strip_margin_y_percent,
    card_record.strip_dimming_enabled, true, '', true,
    array[5, 5], 50, 50
  );
  if result_value <> 'INVALID' then
    raise exception 'Branch staff changed the tenant stamp layout';
  end if;
end;
$$;

reset role;
