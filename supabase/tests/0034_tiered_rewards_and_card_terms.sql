\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);

do $$
declare
  program_id_value uuid;
  result_record record;
  program_record record;
  tier_count integer;
  balance_record record;
  available_tier_rewards integer;
begin
  select id
    into program_id_value
  from public.loyalty_programs
  where tenant_id = '10000000-0000-0000-0000-000000000002';

  select *
    into result_record
  from app.save_loyalty_program_with_tiers(
    program_id_value,
    'Programa acumulable Tenant B',
    'ACTIVE',
    'PER_PURCHASE',
    0,
    8,
    null,
    false,
    'Los premios se acumulan y el premio de 10 sellos reinicia el ciclo conservando el excedente.',
    '[
      {"stamps_required": 3, "name": "Café chico", "description": "Un café chico de cortesía", "expiration_days": 7},
      {"stamps_required": 5, "name": "Pan dulce", "description": "Una pieza de pan dulce", "expiration_days": 14},
      {"stamps_required": 10, "name": "Desayuno completo", "description": "Un desayuno completo de cortesía", "expiration_days": 30}
    ]'::jsonb
  );

  select *
    into program_record
  from public.loyalty_programs
  where id = program_id_value;

  select count(*)
    into tier_count
  from public.loyalty_reward_tiers
  where program_id = program_id_value
    and active;

  select *
    into balance_record
  from public.customer_loyalty_balances
  where customer_id = '30000000-0000-0000-0000-000000000002';

  select count(*)
    into available_tier_rewards
  from public.rewards
  where customer_id = '30000000-0000-0000-0000-000000000002'
    and program_id = program_id_value
    and status = 'AVAILABLE'
    and reward_cycle = 3
    and stamps_required_snapshot in (3, 5);

  if result_record.result <> 'UPDATED'
    or result_record.saved_program_id <> program_id_value
    or program_record.reward_stamp_goal <> 10
    or program_record.reward_name <> 'Desayuno completo'
    or program_record.terms_and_conditions not like 'Los premios se acumulan%'
    or tier_count <> 3
    or balance_record.stamp_balance <> 5
    or balance_record.completed_cycles <> 2
    or available_tier_rewards <> 2 then
    raise exception 'Tiered program configuration did not preserve balance or award current-cycle tiers';
  end if;
end;
$$;

do $$
declare
  result_record record;
  purchase_record record;
  balance_record record;
  source_reward_count integer;
  source_reward_thresholds integer[];
begin
  select *
    into result_record
  from app.confirm_purchase(
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    'T-TIERED-0034',
    1000,
    null,
    null
  );

  select *
    into purchase_record
  from public.purchases
  where id = result_record.purchase_id;

  select *
    into balance_record
  from public.customer_loyalty_balances
  where customer_id = '30000000-0000-0000-0000-000000000002';

  select count(*), array_agg(stamps_required_snapshot order by stamps_required_snapshot)
    into source_reward_count, source_reward_thresholds
  from public.rewards
  where source_purchase_id = result_record.purchase_id;

  if result_record.result <> 'CONFIRMED'
    or result_record.stamps_awarded <> 8
    or result_record.rewards_generated <> 2
    or purchase_record.reward_cycles_completed <> 1
    or purchase_record.reward_cycle_goal <> 10
    or balance_record.stamp_balance <> 3
    or balance_record.completed_cycles <> 3
    or source_reward_count <> 2
    or source_reward_thresholds <> array[3, 10] then
    raise exception 'Purchase did not award the top tier plus the next-cycle small tier';
  end if;
end;
$$;

do $$
declare
  purchase_id_value uuid;
  result_value text;
  balance_record record;
  cancelled_reward_count integer;
begin
  select id
    into purchase_id_value
  from public.purchases
  where ticket_number = 'T-TIERED-0034';

  select app.cancel_purchase(
    purchase_id_value,
    'Validación de reversión de niveles acumulables'
  ) into result_value;

  select *
    into balance_record
  from public.customer_loyalty_balances
  where customer_id = '30000000-0000-0000-0000-000000000002';

  select count(*)
    into cancelled_reward_count
  from public.rewards
  where source_purchase_id = purchase_id_value
    and status = 'CANCELLED';

  if result_value <> 'CANCELLED'
    or balance_record.stamp_balance <> 5
    or balance_record.completed_cycles <> 2
    or cancelled_reward_count <> 2 then
    raise exception 'Tiered purchase cancellation did not restore the previous cycle state';
  end if;
end;
$$;

do $$
declare
  result_record record;
begin
  select *
    into result_record
  from app.save_loyalty_program_with_tiers(
    (
      select id
      from public.loyalty_programs
      where tenant_id = '10000000-0000-0000-0000-000000000002'
    ),
    'Configuración inválida',
    'ACTIVE',
    'PER_PURCHASE',
    0,
    1,
    null,
    false,
    'Estos términos no deben guardarse porque los niveles están duplicados.',
    '[
      {"stamps_required": 5, "name": "Premio uno", "description": "Primero", "expiration_days": null},
      {"stamps_required": 5, "name": "Premio dos", "description": "Segundo", "expiration_days": null}
    ]'::jsonb
  );

  if result_record.result <> 'INVALID' then
    raise exception 'Duplicate reward thresholds were accepted';
  end if;
end;
$$;

select public_token as tiered_card_token
from public.customer_cards
where customer_id = '30000000-0000-0000-0000-000000000002'\gset

reset role;
set role anon;

do $$
begin
  begin
    perform 1 from public.loyalty_reward_tiers;
    raise exception 'Anonymous role queried reward tier storage directly';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select 1 / nullif(
  case
    when count(*) = 1
      and max(program_status) = 'ACTIVE'
      and max(terms_and_conditions) like 'Los premios se acumulan%'
      and jsonb_array_length(max(reward_tiers::text)::jsonb) = 3
      and max(reward_tiers::text)::jsonb -> 0 ->> 'name' = 'Café chico'
      and max(reward_tiers::text)::jsonb -> 2 ->> 'stamps_required' = '10'
    then 1 else 0
  end,
  0
) as public_card_tiers_assertion
from app.get_public_web_card(:'tiered_card_token');

reset role;

select 'Tiered rewards and card terms assertions passed' as result;
