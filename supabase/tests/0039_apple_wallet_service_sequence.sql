\set ON_ERROR_STOP on

begin;

set role service_role;

do $$
declare
  saved_card_id uuid;
  saved_update_tag bigint;
begin
  select id into saved_card_id
  from public.customer_cards
  where customer_id = '30000000-0000-0000-0000-000000000001';

  if saved_card_id is null then
    raise exception 'Expected the Apple Wallet service-role fixture card';
  end if;

  insert into public.wallet_passes (
    tenant_id,
    customer_id,
    customer_card_id,
    provider,
    status,
    serial_number,
    last_synced_at
  )
  values (
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    saved_card_id,
    'APPLE',
    'ACTIVE',
    saved_card_id::text,
    now()
  )
  returning update_tag into saved_update_tag;

  if saved_update_tag is null or saved_update_tag <= 0 then
    raise exception 'Service-role pass issuance did not receive an update tag';
  end if;
end;
$$;

reset role;
set role authenticated;

do $$
begin
  if has_sequence_privilege(
    current_user,
    'public.apple_wallet_update_tag_seq',
    'USAGE'
  ) then
    raise exception 'Authenticated unexpectedly has Apple Wallet sequence usage';
  end if;

  begin
    perform nextval('public.apple_wallet_update_tag_seq');
    raise exception 'Authenticated advanced the Apple Wallet update sequence';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
rollback;

select 'Apple Wallet service-role sequence assertions passed' as result;
