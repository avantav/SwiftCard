\set ON_ERROR_STOP on

select id as lifetime_card_id
from public.loyalty_cards
where tenant_id = '10000000-0000-0000-0000-000000000001'
  and status = 'PUBLISHED'
order by published_at
limit 1\gset

select public_registration_token as lifetime_branch_token
from public.branches
where id = '20000000-0000-0000-0000-000000000001'\gset

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

select app.save_loyalty_card_program(
  :'lifetime_card_id', 'Puntos de por vida', 'LIFETIME_POINTS', 'PER_AMOUNT',
  0, 1, 10000, false,
  'Los puntos se acumulan sin reinicio y cada hito se entrega una sola vez.',
  '[{"stamps_required":1,"name":"Primer hito","description":"Premio inicial","expiration_days":null},{"stamps_required":2,"name":"Segundo hito","description":"Premio siguiente","expiration_days":30}]'::jsonb,
  'punto', 'puntos'
) as lifetime_program_result\gset

select case when :'lifetime_program_result' = 'SAVED' then 1 else 1 / 0 end
  as lifetime_program_saved_assertion;

reset role;
set role anon;

select result, card_token
from app.register_public_customer(
  :'lifetime_branch_token', :'lifetime_card_id', 'Cliente de puntos',
  '+528199997777', 'puntos@example.com', null, true
)\gset lifetime_registration_

select case when :'lifetime_registration_result' = 'CREATED' then 1 else 1 / 0 end
  as lifetime_registration_assertion;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);

select customer_card_id
from app.resolve_staff_card_scan(:'lifetime_registration_card_token')
where result = 'FOUND'\gset lifetime_

select set_config('test.lifetime_customer_card_id', :'lifetime_customer_card_id', false);
select set_config('test.lifetime_card_token', :'lifetime_registration_card_token', false);
select set_config('test.lifetime_card_id', :'lifetime_card_id', false);

select result, stamps_awarded, rewards_generated
from app.confirm_card_purchase(
  :'lifetime_customer_card_id',
  '20000000-0000-0000-0000-000000000001',
  'LIFETIME-001', 15500, null, null
)\gset first_

select case when :'first_result' = 'CONFIRMED'
  and :'first_stamps_awarded' = '1'
  and :'first_rewards_generated' = '1'
  then 1 else 1 / 0 end as first_lifetime_purchase_assertion;

select result, stamps_awarded, rewards_generated
from app.confirm_card_purchase(
  :'lifetime_customer_card_id',
  '20000000-0000-0000-0000-000000000001',
  'LIFETIME-002', 7000, null, null
)\gset second_

select case when :'second_result' = 'CONFIRMED'
  and :'second_stamps_awarded' = '0'
  and :'second_rewards_generated' = '1'
  then 1 else 1 / 0 end as second_lifetime_purchase_assertion;

do $$
declare
  customer_id_value uuid;
  balance_record record;
  reward_count integer;
  purchase_tenths bigint[];
  ledger_tenths bigint[];
  summary_record record;
begin
  select customer_id into customer_id_value
  from public.customer_cards
  where id = current_setting('test.lifetime_customer_card_id')::uuid;

  select stamp_balance, lifetime_points_tenths, remainder_minor, completed_cycles
    into balance_record
  from public.customer_loyalty_balances
  where customer_id = customer_id_value;

  select count(*) into reward_count
  from public.rewards
  where customer_id = customer_id_value
    and reward_cycle = 0;

  select array_agg(units_awarded_tenths order by ticket_number)
    into purchase_tenths
  from public.purchases
  where customer_id = customer_id_value
    and ticket_number like 'LIFETIME-%';

  select array_agg(units_delta_tenths order by created_at, id)
    into ledger_tenths
  from public.stamp_ledger
  where customer_id = customer_id_value
    and purchase_id is not null;

  select * into summary_record
  from app.get_staff_customer_card_summary(
    current_setting('test.lifetime_customer_card_id')::uuid
  );

  if balance_record.lifetime_points_tenths <> 22
    or balance_record.stamp_balance <> 2
    or balance_record.remainder_minor <> 0
    or balance_record.completed_cycles <> 0
    or reward_count <> 2
    or purchase_tenths <> array[15::bigint, 7::bigint]
    or ledger_tenths <> array[15::bigint, 7::bigint]
    or summary_record.stamp_balance <> 2
    or summary_record.unit_name_plural <> 'puntos' then
    raise exception 'Lifetime points did not preserve tenths, milestones, or integer staff projection';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare
  customer_id_value uuid;
  purchase_id_value uuid;
  reward_id_value uuid;
  card_stats record;
  balance_tenths bigint;
  expected_card_units numeric(20, 1);
begin
  select issued.customer_id into customer_id_value
  from public.customer_cards issued
  where issued.id = current_setting('test.lifetime_customer_card_id')::uuid;

  select purchase.id into purchase_id_value
  from public.purchases purchase
  where purchase.customer_id = customer_id_value
    and purchase.ticket_number = 'LIFETIME-002';

  begin
    perform app.cancel_purchase(purchase_id_value, 'No debe permitirse');
    raise exception 'Lifetime purchase cancellation was accepted';
  exception when check_violation then null;
  end;

  select reward.id into reward_id_value
  from public.rewards reward
  where reward.customer_id = customer_id_value
    and reward.status = 'AVAILABLE'
  order by reward.stamps_required_snapshot desc
  limit 1;

  begin
    perform app.cancel_reward(reward_id_value, 'No debe permitirse');
    raise exception 'Lifetime reward cancellation was accepted';
  exception when check_violation then null;
  end;

  select * into card_stats
  from app.get_loyalty_card_stats(current_setting('test.lifetime_card_id')::uuid);

  select balance.lifetime_points_tenths into balance_tenths
  from public.customer_loyalty_balances balance
  where balance.customer_id = customer_id_value;

  select (coalesce(sum(purchase.units_awarded_tenths), 0)::numeric / 10)::numeric(20, 1)
    into expected_card_units
  from public.purchases purchase
  where purchase.loyalty_card_id = current_setting('test.lifetime_card_id')::uuid
    and purchase.status = 'CONFIRMED';

  if card_stats.units_awarded <> expected_card_units
    or balance_tenths <> 22
    or (select status from public.purchases where id = purchase_id_value) <> 'CONFIRMED'
    or (select status from public.rewards where id = reward_id_value) <> 'AVAILABLE' then
    raise exception 'Lifetime administrative precision or cancellation policies are incorrect';
  end if;
end;
$$;

do $$
declare
  customer_id_value uuid;
begin
  select customer_id into customer_id_value
  from public.customer_cards
  where id = current_setting('test.lifetime_customer_card_id')::uuid;
  begin
    perform app.adjust_customer_stamps(
      customer_id_value,
      '20000000-0000-0000-0000-000000000001',
      1,
      'Ajuste que debe rechazarse'
    );
    raise exception 'Lifetime point adjustment was accepted';
  exception when check_violation then null;
  end;
end;
$$;

reset role;
set role anon;

do $$
declare
  public_record record;
begin
  select * into public_record
  from app.get_public_web_card(current_setting('test.lifetime_card_token'));
  if public_record.program_type <> 'LIFETIME_POINTS'
    or public_record.stamp_balance <> 2
    or public_record.balance_tenths <> 22
    or public_record.unit_name_plural <> 'puntos' then
    raise exception 'Public lifetime point projection is incorrect';
  end if;
end;
$$;

reset role;

select 'Lifetime point engine assertions passed' as result;
