\set ON_ERROR_STOP on

-- Dedicated tenant with one card per program type, a manager for the PWA
-- path and twin customers: one receives PWA purchases, the other the same
-- purchases from SwiftPOS. Another tenant checks isolation.
insert into public.tenants (id, name, status) values
  ('81000000-0000-0000-0000-0000000000a1', 'Tenant SwiftPOS', 'ACTIVE'),
  ('81000000-0000-0000-0000-0000000000a2', 'Tenant Ajeno', 'ACTIVE');
insert into public.branches (id, tenant_id, name) values
  ('81000000-0000-0000-0000-0000000000b1', '81000000-0000-0000-0000-0000000000a1', 'Centro'),
  ('81000000-0000-0000-0000-0000000000b2', '81000000-0000-0000-0000-0000000000a2', 'Ajena');
insert into auth.users (id, email) values
  ('81000000-0000-0000-0000-000000000011', 'manager-81@swiftwallet.test'),
  ('81000000-0000-0000-0000-000000000012', 'admin-81@swiftwallet.test');
insert into public.staff_profiles (id, tenant_id, email, full_name, role, status) values
  ('81000000-0000-0000-0000-000000000011', '81000000-0000-0000-0000-0000000000a1', 'manager-81@swiftwallet.test', 'Manager 81', 'MANAGER', 'ACTIVE'),
  ('81000000-0000-0000-0000-000000000012', '81000000-0000-0000-0000-0000000000a1', 'admin-81@swiftwallet.test', 'Admin 81', 'ADMIN', 'ACTIVE');
insert into public.staff_branch_assignments (staff_profile_id, branch_id, tenant_id) values
  ('81000000-0000-0000-0000-000000000011', '81000000-0000-0000-0000-0000000000b1', '81000000-0000-0000-0000-0000000000a1');

insert into public.loyalty_programs (
  id, tenant_id, name, rule_type, reward_stamp_goal, reward_name, status, program_type,
  minimum_purchase_minor, stamps_per_purchase, amount_per_stamp_minor, carry_remainder,
  allow_purchase_cancellations, allow_reward_cancellations
) values
  ('81100000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-0000000000a1', 'Por compra', 'PER_PURCHASE', 3, 'Café', 'ACTIVE', 'STAMPS_PER_PURCHASE', 1000, 1, null, true, true, true),
  ('81100000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-0000000000a1', 'Por monto', 'PER_AMOUNT', 4, 'Postre', 'ACTIVE', 'STAMPS_PER_AMOUNT', 0, 1, 5000, true, true, true),
  ('81100000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-0000000000a1', 'Puntos', 'PER_AMOUNT', 100, 'Comida', 'ACTIVE', 'LIFETIME_POINTS', 0, 1, 1000, false, false, false);
insert into public.loyalty_reward_tiers (tenant_id, program_id, stamps_required, name, active) values
  ('81000000-0000-0000-0000-0000000000a1', '81100000-0000-0000-0000-000000000001', 3, 'Café', true),
  ('81000000-0000-0000-0000-0000000000a1', '81100000-0000-0000-0000-000000000002', 4, 'Postre', true),
  ('81000000-0000-0000-0000-0000000000a1', '81100000-0000-0000-0000-000000000003', 10, 'Bebida', true),
  ('81000000-0000-0000-0000-0000000000a1', '81100000-0000-0000-0000-000000000003', 30, 'Comida', true)
on conflict do nothing;
insert into public.loyalty_cards (id, tenant_id, program_id, name, logo_text, description, background_color, status, published_at) values
  ('81200000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-0000000000a1', '81100000-0000-0000-0000-000000000001', 'Tarjeta compra', 'C', 'Compra', '#10253D', 'PUBLISHED', now()),
  ('81200000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-0000000000a1', '81100000-0000-0000-0000-000000000002', 'Tarjeta monto', 'M', 'Monto', '#10253D', 'PUBLISHED', now()),
  ('81200000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-0000000000a1', '81100000-0000-0000-0000-000000000003', 'Tarjeta puntos', 'P', 'Puntos', '#10253D', 'PUBLISHED', now());
insert into public.loyalty_card_branches (loyalty_card_id, branch_id, tenant_id) values
  ('81200000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-0000000000b1', '81000000-0000-0000-0000-0000000000a1'),
  ('81200000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-0000000000b1', '81000000-0000-0000-0000-0000000000a1'),
  ('81200000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-0000000000b1', '81000000-0000-0000-0000-0000000000a1');

-- c1x = PWA twin, c2x = SwiftPOS twin, for program x. c99 belongs to the other tenant.
insert into public.customers (id, tenant_id, full_name, normalized_phone, privacy_consent, registration_method, source_branch_id) values
  ('81300000-0000-0000-0000-000000000011', '81000000-0000-0000-0000-0000000000a1', 'Ana Staff', '+528100008111', true, 'SELF_SERVICE', '81000000-0000-0000-0000-0000000000b1'),
  ('81300000-0000-0000-0000-000000000012', '81000000-0000-0000-0000-0000000000a1', 'Beto Staff', '+528100008112', true, 'SELF_SERVICE', '81000000-0000-0000-0000-0000000000b1'),
  ('81300000-0000-0000-0000-000000000013', '81000000-0000-0000-0000-0000000000a1', 'Caro Staff', '+528100008113', true, 'SELF_SERVICE', '81000000-0000-0000-0000-0000000000b1'),
  ('81300000-0000-0000-0000-000000000021', '81000000-0000-0000-0000-0000000000a1', 'Ana Pos', '+528100008121', true, 'SELF_SERVICE', '81000000-0000-0000-0000-0000000000b1'),
  ('81300000-0000-0000-0000-000000000022', '81000000-0000-0000-0000-0000000000a1', 'Beto Pos', '+528100008122', true, 'SELF_SERVICE', '81000000-0000-0000-0000-0000000000b1'),
  ('81300000-0000-0000-0000-000000000023', '81000000-0000-0000-0000-0000000000a1', 'Caro Pos López', '+528100008123', true, 'SELF_SERVICE', '81000000-0000-0000-0000-0000000000b1'),
  ('81300000-0000-0000-0000-000000000099', '81000000-0000-0000-0000-0000000000a2', 'Ajeno', '+528100008199', true, 'SELF_SERVICE', '81000000-0000-0000-0000-0000000000b2');
insert into public.customer_cards (id, tenant_id, customer_id, loyalty_card_id, public_token) values
  ('81400000-0000-0000-0000-000000000011', '81000000-0000-0000-0000-0000000000a1', '81300000-0000-0000-0000-000000000011', '81200000-0000-0000-0000-000000000001', 'token-81-s1-0000000000000000000000000000000000'),
  ('81400000-0000-0000-0000-000000000012', '81000000-0000-0000-0000-0000000000a1', '81300000-0000-0000-0000-000000000012', '81200000-0000-0000-0000-000000000002', 'token-81-s2-0000000000000000000000000000000000'),
  ('81400000-0000-0000-0000-000000000013', '81000000-0000-0000-0000-0000000000a1', '81300000-0000-0000-0000-000000000013', '81200000-0000-0000-0000-000000000003', 'token-81-s3-0000000000000000000000000000000000'),
  ('81400000-0000-0000-0000-000000000021', '81000000-0000-0000-0000-0000000000a1', '81300000-0000-0000-0000-000000000021', '81200000-0000-0000-0000-000000000001', 'token-81-p1-0000000000000000000000000000000000'),
  ('81400000-0000-0000-0000-000000000022', '81000000-0000-0000-0000-0000000000a1', '81300000-0000-0000-0000-000000000022', '81200000-0000-0000-0000-000000000002', 'token-81-p2-0000000000000000000000000000000000'),
  ('81400000-0000-0000-0000-000000000023', '81000000-0000-0000-0000-0000000000a1', '81300000-0000-0000-0000-000000000023', '81200000-0000-0000-0000-000000000003', 'token-81-p3-0000000000000000000000000000000000'),
  ('81400000-0000-0000-0000-000000000099', '81000000-0000-0000-0000-0000000000a2', '81300000-0000-0000-0000-000000000099', null, 'token-81-x9-0000000000000000000000000000000000');

create temp table test_keys_0081 (name text primary key, key_hash text not null);
insert into test_keys_0081 values
  ('test', encode(extensions.digest('sc_test_key_0081', 'sha256'), 'hex')),
  ('rate', encode(extensions.digest('sc_rate_key_0081', 'sha256'), 'hex'));
grant select on test_keys_0081 to authenticated, service_role;

-- Superadmin: tenant admins cannot administer; issue a key, link the store, set limits.
set role authenticated;
do $$
begin
  perform set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000012', false);
  begin
    perform app.issue_integration_key('81000000-0000-0000-0000-0000000000a1', 'abcd1234', repeat('a', 64), 'Prueba');
    raise exception 'Tenant admin issued an integration key';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.integration_keys) <> 0 then
    raise exception 'Tenant admin can read integration keys';
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
  if app.issue_integration_key('81000000-0000-0000-0000-0000000000a1', 'BAD', repeat('a', 64), 'Prueba') <> 'INVALID' then
    raise exception 'Invalid prefix accepted';
  end if;
  if app.issue_integration_key('81000000-0000-0000-0000-0000000000a1', 'test0081',
      (select key_hash from test_keys_0081 where name = 'test'), 'Primera llave') <> 'ISSUED' then
    raise exception 'Superadmin could not issue a key';
  end if;
  if app.issue_integration_key('81000000-0000-0000-0000-0000000000a1', 'rate0081',
      (select key_hash from test_keys_0081 where name = 'rate'), 'Llave de límite') <> 'ISSUED' then
    raise exception 'Superadmin could not issue a second key';
  end if;
  if app.issue_integration_key('81000000-0000-0000-0000-0000000000a1', 'third081', repeat('b', 64), 'Tercera') <> 'TOO_MANY_KEYS' then
    raise exception 'More than two active keys allowed';
  end if;
  if app.set_integration_branch_link('81000000-0000-0000-0000-0000000000a1', 'store-ajena', '81000000-0000-0000-0000-0000000000b2', 'Sucursal ajena') <> 'INVALID' then
    raise exception 'Another tenant branch was linked';
  end if;
  if app.set_integration_branch_link('81000000-0000-0000-0000-0000000000a1', 'store-1', '81000000-0000-0000-0000-0000000000b1', 'Caja centro') <> 'UPDATED' then
    raise exception 'Superadmin could not link the store';
  end if;
  if app.set_integration_limits('81000000-0000-0000-0000-0000000000a1', 2000000, 50, 10, 'Orden inválido') <> 'INVALID' then
    raise exception 'Hour limit above day limit accepted';
  end if;
  if app.set_integration_limits('81000000-0000-0000-0000-0000000000a1', 2000000, 50, 100, 'Límites de prueba') <> 'UPDATED' then
    raise exception 'Superadmin could not set limits';
  end if;
  if app.set_module_global('swiftpos_integration', 'BETA', 'Piloto SwiftPOS') <> 'UPDATED'
    or app.set_tenant_module('swiftpos_integration', '81000000-0000-0000-0000-0000000000a1', 'GRANTED', null, 'Piloto') <> 'UPDATED' then
    raise exception 'Superadmin could not enable the module';
  end if;
end;
$$;

-- Tenant staff cannot call the integration functions.
do $$
begin
  perform set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000012', false);
  begin
    perform * from app.integration_status((select key_hash from test_keys_0081 where name = 'test'));
    raise exception 'Authenticated role called the integration';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- PWA path for the staff twins.
create temp table parity_results (program integer, step integer, path text, result text, stamps integer, rewards integer);
grant all on parity_results to authenticated, service_role;

do $$
declare
  amounts bigint[] := array[1200, 4800, 7300, 15000, 900];
  r record;
  p integer;
  s integer;
begin
  perform set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000011', false);
  for p in 1..3 loop
    for s in 1..array_length(amounts, 1) loop
      select * into r from app.confirm_card_purchase(
        ('81400000-0000-0000-0000-00000000001' || p)::uuid, '81000000-0000-0000-0000-0000000000b1',
        'S-' || p || '-' || s, amounts[s], null, null);
      insert into parity_results values (p, s, 'STAFF', r.result, r.stamps_awarded, r.rewards_generated);
    end loop;
  end loop;
end;
$$;

reset role;
set role service_role;

-- SwiftPOS path for the twins, plus every rejection path.
do $$
declare
  key_hash text := (select key_hash from test_keys_0081 where name = 'test');
  integration uuid := (select id from public.tenant_integrations where tenant_id = '81000000-0000-0000-0000-0000000000a1');
  branch uuid := '81000000-0000-0000-0000-0000000000b1';
  amounts bigint[] := array[1200, 4800, 7300, 15000, 900];
  r record;
  p integer;
  s integer;
begin
  -- Identification.
  select * into r from app.integration_resolve_card(repeat('0', 64), 'store-1', 'token-81-p3-0000000000000000000000000000000000');
  if r.result <> 'UNAUTHORIZED' then raise exception 'Unknown key accepted: %', r.result; end if;
  select * into r from app.integration_resolve_card(key_hash, 'store-x', 'token-81-p3-0000000000000000000000000000000000');
  if r.result <> 'BRANCH_NOT_LINKED' then raise exception 'Unlinked store accepted: %', r.result; end if;
  select * into r from app.integration_resolve_card(key_hash, 'store-1', 'token-81-x9-0000000000000000000000000000000000');
  if r.result <> 'CARD_NOT_FOUND' then raise exception 'Other tenant card resolved: %', r.result; end if;
  select * into r from app.integration_resolve_card(key_hash, 'store-1', 'token-81-p3-0000000000000000000000000000000000');
  if r.result <> 'FOUND' or r.first_name <> 'Caro' or r.customer_card_id <> '81400000-0000-0000-0000-000000000023'
    or r.integration_id <> integration or r.branch_id <> branch or r.program_type <> 'LIFETIME_POINTS' then
    raise exception 'Unexpected resolve result: %', row_to_json(r);
  end if;

  for p in 1..3 loop
    for s in 1..array_length(amounts, 1) loop
      select * into r from app.integration_confirm_purchase(
        key_hash, 'store-1', ('81400000-0000-0000-0000-00000000002' || p)::uuid, integration, branch,
        'sale-' || p || '-' || s, 'P-' || p || '-' || s, amounts[s], now(), 'emp-7', 'Luis P.', null, null);
      insert into parity_results values (p, s, 'SWIFTPOS', r.result, r.stamps_awarded, r.rewards_generated);
    end loop;
  end loop;

  -- Idempotency and conflicts.
  select * into r from app.integration_confirm_purchase(key_hash, 'store-1', '81400000-0000-0000-0000-000000000021', integration, branch,
    'sale-1-1', 'P-1-1', 1200, now(), 'emp-7', 'Luis P.', null, null);
  if r.result <> 'ALREADY_RECORDED' then raise exception 'Retry not idempotent: %', r.result; end if;
  select * into r from app.integration_confirm_purchase(key_hash, 'store-1', '81400000-0000-0000-0000-000000000021', integration, branch,
    'sale-1-1', 'P-1-1', 9999, now(), 'emp-7', 'Luis P.', null, null);
  if r.result <> 'IDEMPOTENCY_CONFLICT' then raise exception 'Changed retry accepted: %', r.result; end if;

  -- Ticket binding, limits and duplicates.
  select * into r from app.integration_confirm_purchase(key_hash, 'store-1', '81400000-0000-0000-0000-000000000021', gen_random_uuid(), branch,
    'sale-x1', 'P-x1', 1200, now(), 'emp-7', 'Luis P.', null, null);
  if r.result <> 'SCAN_TICKET_MISMATCH' then raise exception 'Foreign scan ticket accepted: %', r.result; end if;
  select * into r from app.integration_confirm_purchase(key_hash, 'store-1', '81400000-0000-0000-0000-000000000021', integration, branch,
    'sale-x2', 'P-x2', 2000001, now(), 'emp-7', 'Luis P.', null, null);
  if r.result <> 'LIMIT_EXCEEDED' then raise exception 'Amount above limit accepted: %', r.result; end if;
  select * into r from app.integration_confirm_purchase(key_hash, 'store-1', '81400000-0000-0000-0000-000000000021', integration, branch,
    'sale-x3', 'P-x3', 1200, now() - interval '4 days', 'emp-7', 'Luis P.', null, null);
  if r.result <> 'LIMIT_EXCEEDED' then raise exception 'Old sale accepted: %', r.result; end if;
  select * into r from app.integration_confirm_purchase(key_hash, 'store-1', '81400000-0000-0000-0000-000000000021', integration, branch,
    'sale-x4', 'S-1-1', 1200, now(), 'emp-7', 'Luis P.', null, null);
  if r.result <> 'DUPLICATE_TICKET' then raise exception 'Ticket already captured in the PWA accepted: %', r.result; end if;
  select * into r from app.integration_confirm_purchase(key_hash, 'store-1', '81400000-0000-0000-0000-000000000099', integration, branch,
    'sale-x5', 'P-x5', 1200, now(), 'emp-7', 'Luis P.', null, null);
  if r.result <> 'CARD_NOT_FOUND' then raise exception 'Other tenant card accepted: %', r.result; end if;
  select * into r from app.integration_confirm_purchase(key_hash, 'store-1', '81400000-0000-0000-0000-000000000021', integration, branch,
    'sale-x6', 'P-x6', 1200, now(), '', 'Luis P.', null, null);
  if r.result <> 'INVALID' then raise exception 'Missing cashier accepted: %', r.result; end if;
end;
$$;

reset role;

-- Parity: same results step by step, same balances and rewards.
do $$
declare
  mismatch record;
begin
  if (select count(*) from parity_results where result <> 'CONFIRMED') > 0 then
    raise exception 'Not every parity purchase was confirmed: %', (select json_agg(row_to_json(x)) from parity_results x where result <> 'CONFIRMED');
  end if;
  select s.program, s.step, s.stamps as staff_stamps, i.stamps as pos_stamps, s.rewards as staff_rewards, i.rewards as pos_rewards
  into mismatch
  from parity_results s join parity_results i on i.program = s.program and i.step = s.step and i.path = 'SWIFTPOS'
  where s.path = 'STAFF' and (s.stamps, s.rewards) is distinct from (i.stamps, i.rewards)
  limit 1;
  if mismatch.program is not null then
    raise exception 'Parity mismatch: %', row_to_json(mismatch);
  end if;
  if exists (
    select 1 from generate_series(1, 3) p
    join public.customer_loyalty_balances s on s.customer_id = ('81300000-0000-0000-0000-00000000001' || p)::uuid
    join public.customer_loyalty_balances i on i.customer_id = ('81300000-0000-0000-0000-00000000002' || p)::uuid
    where (s.stamp_balance, s.remainder_minor, s.lifetime_points_tenths)
      is distinct from (i.stamp_balance, i.remainder_minor, i.lifetime_points_tenths)
  ) then
    raise exception 'Balances differ between PWA and SwiftPOS';
  end if;
  if exists (
    select 1 from generate_series(1, 3) p
    where (select count(*) from public.rewards where customer_id = ('81300000-0000-0000-0000-00000000001' || p)::uuid)
      <> (select count(*) from public.rewards where customer_id = ('81300000-0000-0000-0000-00000000002' || p)::uuid)
  ) then
    raise exception 'Rewards differ between PWA and SwiftPOS';
  end if;
  if (select count(*) from public.rewards where customer_id in (
      '81300000-0000-0000-0000-000000000021', '81300000-0000-0000-0000-000000000022', '81300000-0000-0000-0000-000000000023')) = 0 then
    raise exception 'Parity scenario generated no rewards';
  end if;
  if exists (select 1 from public.purchases where source = 'SWIFTPOS'
      and (staff_profile_id is not null or external_operator_name <> 'Luis P.')) then
    raise exception 'Integration purchases must have no staff and keep the cashier';
  end if;
  if exists (select 1 from public.stamp_ledger l join public.purchases p on p.id = l.purchase_id
      where p.source = 'SWIFTPOS' and l.created_by_staff_id is not null) then
    raise exception 'Integration ledger entries must have no staff';
  end if;
end;
$$;

-- Location: strict tenant, location switch active then revoked.
update public.tenants set location_validation_mode = 'STRICT' where id = '81000000-0000-0000-0000-0000000000a1';
update public.branches set latitude = 29.0729, longitude = -110.9559, geofence_radius_meters = 200
where id = '81000000-0000-0000-0000-0000000000b1';

set role service_role;
do $$
declare
  key_hash text := (select key_hash from test_keys_0081 where name = 'test');
  integration uuid := (select id from public.tenant_integrations where tenant_id = '81000000-0000-0000-0000-0000000000a1');
  branch uuid := '81000000-0000-0000-0000-0000000000b1';
  r record;
begin
  select * into r from app.integration_confirm_purchase(key_hash, 'store-1', '81400000-0000-0000-0000-000000000021', integration, branch,
    'sale-l1', 'P-l1', 1200, now(), 'emp-7', 'Luis P.', 25.6866, -100.3161);
  if r.result <> 'OUTSIDE_GEOFENCE' then raise exception 'Far location accepted: %', r.result; end if;
  select * into r from app.integration_confirm_purchase(key_hash, 'store-1', '81400000-0000-0000-0000-000000000021', integration, branch,
    'sale-l2', 'P-l2', 1200, now(), 'emp-7', 'Luis P.', 29.0730, -110.9560);
  if r.result <> 'CONFIRMED' then raise exception 'Nearby location rejected: %', r.result; end if;
  -- Strict tenants still accept integration purchases without location.
  select * into r from app.integration_confirm_purchase(key_hash, 'store-1', '81400000-0000-0000-0000-000000000021', integration, branch,
    'sale-l3', 'P-l3', 1200, now(), 'emp-7', 'Luis P.', null, null);
  if r.result <> 'CONFIRMED' then raise exception 'Purchase without location rejected: %', r.result; end if;
end;
$$;

reset role;
set role authenticated;
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
  perform app.set_tenant_module('swiftpos_integration.location_validation', '81000000-0000-0000-0000-0000000000a1', 'REVOKED', null, 'GPS impreciso');
  perform app.set_tenant_module('swiftpos_integration.card_resolve', '81000000-0000-0000-0000-0000000000a1', 'REVOKED', null, 'Falla de escaneo');
end;
$$;
reset role;
set role service_role;
do $$
declare
  key_hash text := (select key_hash from test_keys_0081 where name = 'test');
  integration uuid := (select id from public.tenant_integrations where tenant_id = '81000000-0000-0000-0000-0000000000a1');
  branch uuid := '81000000-0000-0000-0000-0000000000b1';
  r record;
  status_modules jsonb;
begin
  select * into r from app.integration_confirm_purchase(key_hash, 'store-1', '81400000-0000-0000-0000-000000000021', integration, branch,
    'sale-l4', 'P-l4', 1200, now(), 'emp-7', 'Luis P.', 25.6866, -100.3161);
  if r.result <> 'CONFIRMED' then raise exception 'Location should be ignored when its switch is revoked: %', r.result; end if;
  if (select latitude from public.purchases where external_sale_id = 'sale-l4') is not null then
    raise exception 'Ignored location was stored';
  end if;
  select * into r from app.integration_resolve_card(key_hash, 'store-1', 'token-81-p1-0000000000000000000000000000000000');
  if r.result <> 'MODULE_NOT_ACTIVE' then raise exception 'Revoked resolve still works: %', r.result; end if;
  select modules into status_modules from app.integration_status(key_hash);
  if status_modules <> '{"swiftpos_integration":true,"swiftpos_integration.card_resolve":false,"swiftpos_integration.purchases":true,"swiftpos_integration.wallet_refresh":true,"swiftpos_integration.location_validation":false}'::jsonb then
    raise exception 'Unexpected status: %', status_modules;
  end if;
end;
$$;
reset role;

-- Module off for everybody and key revocation stop the integration.
set role authenticated;
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
  perform app.set_module_global('swiftpos_integration', 'OFF', 'Apagado de emergencia');
end;
$$;
reset role;
set role service_role;
do $$
declare
  key_hash text := (select key_hash from test_keys_0081 where name = 'test');
  r record;
begin
  select * into r from app.integration_confirm_purchase(key_hash, 'store-1', '81400000-0000-0000-0000-000000000021',
    (select id from public.tenant_integrations where tenant_id = '81000000-0000-0000-0000-0000000000a1'),
    '81000000-0000-0000-0000-0000000000b1', 'sale-off', 'P-off', 1200, now(), 'emp-7', 'Luis P.', null, null);
  if r.result <> 'MODULE_NOT_ACTIVE' then raise exception 'Global off did not stop purchases: %', r.result; end if;
end;
$$;
reset role;

-- Rate limit: 120 requests per key per minute.
set role service_role;
do $$
declare
  key_hash text := (select key_hash from test_keys_0081 where name = 'rate');
  r record;
  i integer;
begin
  for i in 1..120 loop
    select * into r from app.integration_status(key_hash);
    if r.result <> 'OK' then raise exception 'Request % rejected early: %', i, r.result; end if;
  end loop;
  select * into r from app.integration_status(key_hash);
  if r.result <> 'RATE_LIMITED' then raise exception 'Rate limit not applied: %', r.result; end if;
end;
$$;
reset role;

set role authenticated;
do $$
declare
  key_id uuid := (select id from public.integration_keys where key_prefix = 'test0081');
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
  if app.revoke_integration_key(key_id, 'Rotación') <> 'REVOKED' then
    raise exception 'Superadmin could not revoke the key';
  end if;
  if (select count(*) from public.audit_logs where action in (
      'INTEGRATION_KEY_ISSUED', 'INTEGRATION_KEY_REVOKED', 'INTEGRATION_BRANCH_LINK_UPDATED', 'INTEGRATION_LIMITS_UPDATED')) < 5 then
    raise exception 'Integration administration was not audited';
  end if;
end;
$$;
reset role;
set role service_role;
do $$
declare
  r record;
begin
  select * into r from app.integration_status((select key_hash from test_keys_0081 where name = 'test'));
  if r.result <> 'UNAUTHORIZED' then raise exception 'Revoked key still works: %', r.result; end if;
end;
$$;
reset role;
