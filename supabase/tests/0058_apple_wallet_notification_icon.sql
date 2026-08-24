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

  result_value := app.save_loyalty_card_design_v2(
    card_record.id,
    card_record.wallet_enabled,
    card_record.logo_text,
    card_record.description,
    card_record.background_color,
    card_record.foreground_color,
    card_record.label_color,
    coalesce(card_record.logo_image_url, ''),
    coalesce(card_record.strip_image_url, ''),
    'https://project.supabase.co/storage/v1/object/public/wallet-assets/10000000-0000-0000-0000-000000000001/apple/notification-50000000-0000-4000-8000-000000000058.png'
  );
  if result_value <> 'SAVED' then
    raise exception 'Tenant Admin could not save the notification icon';
  end if;
end;
$$;

do $$
declare
  stored_url text;
begin
  select notification_icon_url into stored_url
  from public.loyalty_cards
  where tenant_id = '10000000-0000-0000-0000-000000000001'
    and status = 'PUBLISHED'
  order by published_at
  limit 1;

  if stored_url is distinct from
    'https://project.supabase.co/storage/v1/object/public/wallet-assets/10000000-0000-0000-0000-000000000001/apple/notification-50000000-0000-4000-8000-000000000058.png' then
    raise exception 'Notification icon was not persisted: %', stored_url;
  end if;
end;
$$;

insert into storage.objects (bucket_id, name) values (
  'wallet-assets',
  '10000000-0000-0000-0000-000000000001/apple/notification-50000000-0000-4000-8000-000000000058.png'
);

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

  result_value := app.save_loyalty_card_design_v2(
    card_record.id,
    card_record.wallet_enabled,
    card_record.logo_text,
    card_record.description,
    card_record.background_color,
    card_record.foreground_color,
    card_record.label_color,
    coalesce(card_record.logo_image_url, ''),
    coalesce(card_record.strip_image_url, ''),
    'https://project.supabase.co/forbidden.png'
  );
  if result_value <> 'INVALID' then
    raise exception 'Branch staff changed a tenant card notification icon';
  end if;

  begin
    insert into storage.objects (bucket_id, name) values (
      'wallet-assets',
      '10000000-0000-0000-0000-000000000001/apple/notification-60000000-0000-4000-8000-000000000058.png'
    );
    raise exception 'Branch staff uploaded a tenant notification icon';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
