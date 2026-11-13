\set ON_ERROR_STOP on

-- Dedicated tenant: avoids the three-card limit of the shared fixtures.
insert into public.tenants (id, name, status) values
  ('73000000-0000-0000-0000-0000000000a1', 'Tenant Import 0073', 'ACTIVE');
insert into public.branches (id, tenant_id, name) values
  ('73000000-0000-0000-0000-0000000000b1', '73000000-0000-0000-0000-0000000000a1', 'Centro'),
  ('73000000-0000-0000-0000-0000000000b2', '73000000-0000-0000-0000-0000000000a1', 'Norte');

insert into public.loyalty_programs (
  id, tenant_id, name, rule_type, reward_stamp_goal, reward_name, status,
  program_type, allow_purchase_cancellations, allow_reward_cancellations
) values
  ('73000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-0000000000a1', 'Sellos', 'PER_PURCHASE', 10, 'Café', 'ACTIVE', 'STAMPS_PER_PURCHASE', true, true),
  ('73000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-0000000000a1', 'Puntos', 'PER_AMOUNT', 100, 'Postre', 'ACTIVE', 'LIFETIME_POINTS', false, false);

update public.loyalty_programs set import_stamp_to_point_multiplier = 50
where id = '73000000-0000-0000-0000-000000000002';

insert into public.loyalty_reward_tiers (tenant_id, program_id, stamps_required, name, active) values
  ('73000000-0000-0000-0000-0000000000a1', '73000000-0000-0000-0000-000000000001', 10, 'Café', true),
  ('73000000-0000-0000-0000-0000000000a1', '73000000-0000-0000-0000-000000000002', 100, 'Postre', true),
  ('73000000-0000-0000-0000-0000000000a1', '73000000-0000-0000-0000-000000000002', 300, 'Comida', true)
on conflict do nothing;

insert into public.loyalty_cards (
  id, tenant_id, program_id, name, logo_text, description, background_color, status, published_at
) values
  ('73100000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-0000000000a1', '73000000-0000-0000-0000-000000000001', 'Tarjeta sellos', 'S', 'Sellos', '#10253D', 'PUBLISHED', now()),
  ('73100000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-0000000000a1', '73000000-0000-0000-0000-000000000002', 'Tarjeta puntos', 'P', 'Puntos', '#10253D', 'PUBLISHED', now());

-- Both cards participate only in Centro.
insert into public.loyalty_card_branches (loyalty_card_id, branch_id, tenant_id) values
  ('73100000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-0000000000b1', '73000000-0000-0000-0000-0000000000a1'),
  ('73100000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-0000000000b1', '73000000-0000-0000-0000-0000000000a1');

insert into public.customer_imports (
  id, tenant_id, file_name, file_type, file_size_bytes, status, raw_rows, total_rows, error_rows, uploaded_by
) values
  ('73200000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-0000000000a1', 'sellos.csv', 'text/csv', 10, 'PREVIEWED', '[]', 4, 1, '00000000-0000-0000-0000-000000000001'),
  ('73200000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-0000000000a1', 'puntos.csv', 'text/csv', 10, 'PREVIEWED', '[]', 2, 0, '00000000-0000-0000-0000-000000000001');

-- Tenant administrators cannot run the generic importer.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
begin
  begin
    perform public.confirm_customer_import(
      '73200000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-0000000000b1',
      '73100000-0000-0000-0000-000000000001', '[]'::jsonb
    );
    raise exception 'Tenant administrator confirmed a Superadmin import';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

do $$
declare
  stamps_result jsonb;
  points_result jsonb;
begin
  -- A branch that does not participate in the card is rejected atomically.
  begin
    perform public.confirm_customer_import(
      '73200000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-0000000000b2',
      '73100000-0000-0000-0000-000000000001',
      '[{"full_name":"Fuera","normalized_phone":"+528100007399","initial_stamps":"1"}]'::jsonb
    );
    raise exception 'Import into a non-participating branch was accepted';
  exception when check_violation then
    null;
  end;

  stamps_result := public.confirm_customer_import(
    '73200000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-0000000000b1',
    '73100000-0000-0000-0000-000000000001',
    '[{"full_name":"Veintitres","normalized_phone":"+528100007301","email":"Veinte@Example.com","initial_stamps":"23"},
      {"full_name":"Cero","normalized_phone":"+528100007302","initial_stamps":""},
      {"full_name":"Duplicado","normalized_phone":"+528100007301","initial_stamps":"5"}]'::jsonb
  );
  if stamps_result <> '{"imported":2,"duplicates":1,"errors":1,"rewards":2}'::jsonb then
    raise exception 'Unexpected stamp import result: %', stamps_result;
  end if;

  points_result := public.confirm_customer_import(
    '73200000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-0000000000b1',
    '73100000-0000-0000-0000-000000000002',
    '[{"full_name":"Siete","normalized_phone":"+528100007303","initial_stamps":"7"},
      {"full_name":"Uno","normalized_phone":"+528100007304","initial_stamps":"1"}]'::jsonb
  );
  if points_result <> '{"imported":2,"duplicates":0,"errors":0,"rewards":2}'::jsonb then
    raise exception 'Unexpected lifetime import result: %', points_result;
  end if;
end;
$$;

reset role;

do $$
begin
  -- Stamps: 23 with a goal of 10 => two rewards and three stamps left, on the card.
  if not exists (
    select 1
    from public.customers c
    join public.customer_cards cc on cc.customer_id = c.id
    join public.customer_loyalty_balances b on b.customer_id = c.id
    where c.normalized_phone = '+528100007301'
      and c.email = 'veinte@example.com'
      and c.customer_import_id = '73200000-0000-0000-0000-000000000001'
      and cc.loyalty_card_id = '73100000-0000-0000-0000-000000000001'
      and b.stamp_balance = 3
      and b.completed_cycles = 2
      and (select count(*) from public.rewards r where r.customer_id = c.id
             and r.loyalty_card_id = '73100000-0000-0000-0000-000000000001') = 2
      and exists (select 1 from public.stamp_ledger l where l.customer_id = c.id
             and l.entry_type = 'ADJUSTMENT' and l.stamps_delta = 23 and l.balance_after = 3
             and l.loyalty_card_id = '73100000-0000-0000-0000-000000000001')
  ) then
    raise exception 'Stamp import did not apply reward cycles on the card';
  end if;

  if exists (
    select 1 from public.stamp_ledger l
    join public.customers c on c.id = l.customer_id
    where c.normalized_phone = '+528100007302'
  ) then
    raise exception 'A zero-stamp import wrote a ledger entry';
  end if;

  -- Lifetime: 7 stamps x 50 = 350 points => milestones 100 and 300; 1 x 50 = 50 => none.
  if not exists (
    select 1
    from public.customers c
    join public.customer_loyalty_balances b on b.customer_id = c.id
    where c.normalized_phone = '+528100007303'
      and b.lifetime_points_tenths = 3500
      and (select count(*) from public.rewards r where r.customer_id = c.id
             and r.loyalty_card_id = '73100000-0000-0000-0000-000000000002') = 2
      and exists (select 1 from public.stamp_ledger l where l.customer_id = c.id
             and l.units_delta_tenths = 3500 and l.balance_after_tenths = 3500)
  ) or not exists (
    select 1
    from public.customers c
    join public.customer_loyalty_balances b on b.customer_id = c.id
    where c.normalized_phone = '+528100007304'
      and b.lifetime_points_tenths = 500
      and not exists (select 1 from public.rewards r where r.customer_id = c.id)
  ) then
    raise exception 'Lifetime import did not convert with the multiplier and award milestones';
  end if;

  if (
    select count(*) from public.audit_logs
    where action = 'CUSTOMERS_IMPORTED'
      and tenant_id = '73000000-0000-0000-0000-0000000000a1'
  ) <> 2 or not exists (
    select 1 from public.customer_imports
    where id = '73200000-0000-0000-0000-000000000002'
      and status = 'CONFIRMED' and imported_rows = 2 and loyalty_card_id is null
  ) then
    raise exception 'Imports were not audited or confirmed';
  end if;
end;
$$;
