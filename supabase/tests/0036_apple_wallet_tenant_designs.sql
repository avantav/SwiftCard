\set ON_ERROR_STOP on

begin;

update public.tenants
set status = 'ACTIVE'
where id = '10000000-0000-0000-0000-000000000001';
update public.customers
set status = 'ACTIVE'
where id = '30000000-0000-0000-0000-000000000001';
update public.customer_cards
set status = 'ACTIVE', revoked_at = null
where customer_id = '30000000-0000-0000-0000-000000000001';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare
  result_record record;
  saved_record record;
  audit_count integer;
begin
  select * into result_record
  from app.save_apple_wallet_design(
    true,
    'Tenant A',
    'Tarjeta de recompensas de Tenant A',
    '#17202A',
    '#FFFFFF',
    '#FFFFFF',
    'https://assets.example.test/logo.png',
    'https://assets.example.test/strip.jpg'
  );

  select * into saved_record
  from public.tenant_wallet_designs
  where tenant_id = '10000000-0000-0000-0000-000000000001';

  select count(*) into audit_count
  from public.audit_logs
  where tenant_id = '10000000-0000-0000-0000-000000000001'
    and action = 'APPLE_WALLET_DESIGN_UPDATED';

  if result_record.result <> 'SAVED'
    or result_record.saved_version <> 1
    or not saved_record.apple_enabled
    or saved_record.logo_text <> 'Tenant A'
    or audit_count <> 1 then
    raise exception 'Admin could not save and audit the tenant Apple Wallet design';
  end if;
end;
$$;

do $$
begin
  begin
    update public.tenant_wallet_designs
    set logo_text = 'Bypass'
    where tenant_id = '10000000-0000-0000-0000-000000000001';
    raise exception 'Authenticated role bypassed the design RPC';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);

do $$
declare
  result_record record;
  visible_designs integer;
begin
  select * into result_record
  from app.save_apple_wallet_design(
    false,
    'Manager bypass',
    'Tarjeta modificada por un rol sin permiso',
    '#17202A',
    '#FFFFFF',
    '#FFFFFF',
    '',
    ''
  );
  select count(*) into visible_designs from public.tenant_wallet_designs;

  if result_record.result <> 'UNAVAILABLE' or visible_designs <> 0 then
    raise exception 'Branch Administrator accessed tenant Apple Wallet design';
  end if;
end;
$$;

reset role;
select set_config(
  'test.apple_wallet_card_token',
  (select public_token from public.customer_cards where customer_id = '30000000-0000-0000-0000-000000000001'),
  false
);

set role anon;

do $$
begin
  if not app.public_apple_wallet_is_enabled(current_setting('test.apple_wallet_card_token')) then
    raise exception 'Enabled Apple Wallet card was not publicly discoverable';
  end if;
  if app.public_apple_wallet_is_enabled('missing-card-token') then
    raise exception 'Unknown card exposed Apple Wallet availability';
  end if;

  begin
    perform 1 from public.tenant_wallet_designs;
    raise exception 'Anonymous role queried wallet designs';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;

select 'Apple Wallet tenant design assertions passed' as result;
