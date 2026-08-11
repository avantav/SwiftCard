\set ON_ERROR_STOP on

begin;

do $$
declare
  saved_card_id uuid;
  registration_result text;
  initial_update_tag bigint;
begin
  select id into saved_card_id
  from public.customer_cards
  where customer_id = '30000000-0000-0000-0000-000000000001';

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
  on conflict (provider, customer_card_id) do update
    set status = 'ACTIVE',
        serial_number = excluded.serial_number,
        last_error = null
  returning update_tag into initial_update_tag;

  registration_result := app.register_apple_wallet_device(
    saved_card_id::text,
    repeat('a', 64),
    repeat('b', 64),
    'v1.abcdefghijklmnop.qrstuvwxyz012345.encoded-push-token'
  );
  if registration_result <> 'CREATED' then
    raise exception 'Expected a new Apple Wallet registration, got %', registration_result;
  end if;

  registration_result := app.register_apple_wallet_device(
    saved_card_id::text,
    repeat('a', 64),
    repeat('c', 64),
    'v1.abcdefghijklmnop.qrstuvwxyz012345.updated-push-token'
  );
  if registration_result <> 'UPDATED' then
    raise exception 'Expected an idempotent Apple Wallet registration, got %', registration_result;
  end if;

  if not exists (
    select 1
    from public.apple_wallet_devices device
    join public.apple_wallet_registrations registration
      on registration.device_id = device.id
    join public.wallet_passes wallet_pass
      on wallet_pass.id = registration.wallet_pass_id
    where device.device_library_identifier_hash = repeat('a', 64)
      and device.push_token_hash = repeat('c', 64)
      and wallet_pass.customer_card_id = saved_card_id
      and registration.last_notified_update_tag = wallet_pass.update_tag
  ) then
    raise exception 'Apple Wallet device registration was not stored safely';
  end if;

  insert into public.customer_loyalty_balances (
    tenant_id,
    customer_id,
    stamp_balance,
    remainder_minor
  )
  values (
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    1,
    0
  )
  on conflict (customer_id) do update
    set stamp_balance = public.customer_loyalty_balances.stamp_balance + 1;

  if not exists (
    select 1
    from public.wallet_passes wallet_pass
    join public.apple_wallet_update_outbox outbox
      on outbox.wallet_pass_id = wallet_pass.id
    where wallet_pass.customer_card_id = saved_card_id
      and wallet_pass.status = 'UPDATE_PENDING'
      and wallet_pass.update_tag > initial_update_tag
      and outbox.update_tag = wallet_pass.update_tag
  ) then
    raise exception 'A loyalty balance change did not queue the Apple Wallet pass';
  end if;

  select update_tag into initial_update_tag
  from public.wallet_passes
  where customer_card_id = saved_card_id
    and provider = 'APPLE';

  update public.tenants
  set name = name
  where id = '10000000-0000-0000-0000-000000000001';

  if not exists (
    select 1
    from public.wallet_passes wallet_pass
    join public.apple_wallet_update_outbox outbox
      on outbox.wallet_pass_id = wallet_pass.id
    where wallet_pass.customer_card_id = saved_card_id
      and wallet_pass.update_tag > initial_update_tag
      and outbox.update_tag = wallet_pass.update_tag
  ) then
    raise exception 'A tenant-wide pass change did not replace the queued update tag';
  end if;
end;
$$;

set role authenticated;

do $$
begin
  begin
    perform 1 from public.apple_wallet_devices;
    raise exception 'Authenticated staff read Apple Wallet device secrets';
  exception when insufficient_privilege then null;
  end;

  begin
    perform app.claim_apple_wallet_updates(1, 30, null, null);
    raise exception 'Authenticated staff claimed Apple Wallet update work';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set role service_role;

do $$
declare
  listed_count integer;
  claimed_record record;
  target_record record;
  completion_result boolean;
  unregister_result text;
begin
  select count(*) into listed_count
  from app.list_apple_wallet_updates(repeat('a', 64), 0);
  if listed_count <> 1 then
    raise exception 'Expected one changed pass for the registered device, got %', listed_count;
  end if;

  select * into claimed_record
  from app.claim_apple_wallet_updates(
    1,
    30,
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001'
  );
  if claimed_record.outbox_id is null or claimed_record.claim_token is null then
    raise exception 'Apple Wallet outbox work could not be claimed';
  end if;

  select * into target_record
  from app.get_apple_wallet_push_targets(
    claimed_record.wallet_pass_id,
    claimed_record.update_tag::bigint
  );
  if target_record.device_id is null
    or target_record.push_token_ciphertext not like 'v1.%' then
    raise exception 'Claimed Apple Wallet update has no encrypted push target';
  end if;

  perform app.record_apple_wallet_push_success(
    claimed_record.wallet_pass_id,
    target_record.device_id,
    claimed_record.update_tag::bigint
  );
  completion_result := app.complete_apple_wallet_update(
    claimed_record.outbox_id,
    claimed_record.claim_token
  );
  if not completion_result then
    raise exception 'Apple Wallet outbox completion did not honor the claim token';
  end if;

  select count(*) into listed_count
  from app.list_apple_wallet_updates(
    repeat('a', 64),
    claimed_record.update_tag::bigint
  );
  if listed_count <> 0 then
    raise exception 'Delivered Apple Wallet pass was still listed as changed';
  end if;

  unregister_result := app.unregister_apple_wallet_device(
    claimed_record.serial_number,
    repeat('a', 64)
  );
  if unregister_result <> 'DELETED' then
    raise exception 'Apple Wallet device did not unregister cleanly';
  end if;
end;
$$;

reset role;

do $$
declare
  saved_card_id uuid;
begin
  select id into saved_card_id
  from public.customer_cards
  where customer_id = '30000000-0000-0000-0000-000000000001';

  if exists (
    select 1
    from public.apple_wallet_update_outbox outbox
    join public.wallet_passes wallet_pass on wallet_pass.id = outbox.wallet_pass_id
    where wallet_pass.customer_card_id = saved_card_id
  ) then
    raise exception 'Completed Apple Wallet outbox work was not removed';
  end if;

  if exists (
    select 1 from public.apple_wallet_devices
  ) or exists (
    select 1 from public.apple_wallet_registrations
  ) then
    raise exception 'The final Apple Wallet registration did not clean up its device';
  end if;

  update public.customer_loyalty_balances
  set stamp_balance = stamp_balance + 1
  where customer_id = '30000000-0000-0000-0000-000000000001';

  if exists (
    select 1
    from public.apple_wallet_update_outbox outbox
    join public.wallet_passes wallet_pass on wallet_pass.id = outbox.wallet_pass_id
    where wallet_pass.customer_card_id = saved_card_id
  ) then
    raise exception 'An uninstalled Apple Wallet pass queued unnecessary push work';
  end if;
end;
$$;

rollback;

select 'Apple Wallet update assertions passed' as result;
