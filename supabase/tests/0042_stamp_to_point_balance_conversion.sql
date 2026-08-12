\set ON_ERROR_STOP on

begin;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);

do $$
declare
  tenant_program_id uuid;
  old_program_type public.loyalty_program_type;
  balance_customer_id uuid;
  balance_before integer;
  completed_cycles_before bigint;
  reward_count_before integer;
  old_purchase_rule public.loyalty_rule_type;
  result_record record;
  saved_program record;
  saved_balance record;
  reward_count_after integer;
  saved_purchase_rule public.loyalty_rule_type;
  conversion_ledger_count integer;
  conversion_audit_count integer;
begin
  select id, program_type
    into tenant_program_id, old_program_type
  from public.loyalty_programs
  where tenant_id = '10000000-0000-0000-0000-000000000002';

  select customer_id, stamp_balance, completed_cycles
    into balance_customer_id, balance_before, completed_cycles_before
  from public.customer_loyalty_balances
  where tenant_id = '10000000-0000-0000-0000-000000000002'
    and stamp_balance > 0
  order by customer_id
  limit 1;

  if balance_customer_id is null then
    raise exception 'Expected a nonzero seeded balance for conversion coverage';
  end if;

  select count(*)
    into reward_count_before
  from public.rewards
  where tenant_id = '10000000-0000-0000-0000-000000000002';

  select rule_type
    into old_purchase_rule
  from public.purchases
  where tenant_id = '10000000-0000-0000-0000-000000000002'
  order by created_at
  limit 1;

  select * into result_record
  from app.save_loyalty_program_configuration(
    tenant_program_id,
    'Puntos acumulativos migrados',
    'PAUSED',
    'LIFETIME_POINTS',
    'PER_AMOUNT',
    0,
    1,
    1000,
    false,
    'Los sellos existentes se convierten a puntos sin reescribir el historial.',
    '[{"stamps_required": 100, "name": "Premio", "description": "Hito futuro", "expiration_days": null}]'::jsonb,
    'punto',
    'puntos',
    false,
    null,
    null,
    null,
    false,
    3,
    false,
    false,
    true
  );

  select *
    into saved_program
  from public.loyalty_programs
  where id = tenant_program_id;

  select stamp_balance, remainder_minor, completed_cycles
    into saved_balance
  from public.customer_loyalty_balances
  where customer_id = balance_customer_id;

  select count(*)
    into reward_count_after
  from public.rewards
  where tenant_id = '10000000-0000-0000-0000-000000000002';

  select rule_type
    into saved_purchase_rule
  from public.purchases
  where tenant_id = '10000000-0000-0000-0000-000000000002'
  order by created_at
  limit 1;

  select count(*)
    into conversion_ledger_count
  from public.stamp_ledger
  where tenant_id = '10000000-0000-0000-0000-000000000002'
    and customer_id = balance_customer_id
    and entry_type = 'PROGRAM_CHANGE'
    and balance_after = balance_before * 3
    and stamps_delta = balance_before * 2
    and remainder_after_minor = 0
    and reason = 'Conversión de sellos a puntos (1 sello = 3 puntos)';

  select count(*)
    into conversion_audit_count
  from public.audit_logs
  where tenant_id = '10000000-0000-0000-0000-000000000002'
    and entity_id = tenant_program_id
    and action = 'LOYALTY_PROGRAM_BALANCES_CONVERTED'
    and metadata->>'previous_program_type' = old_program_type::text
    and metadata->>'new_program_type' = 'LIFETIME_POINTS'
    and metadata->>'conversion' = 'STAMPS_TO_POINTS'
    and metadata->>'stamp_to_point_multiplier' = '3'
    and metadata->>'remainder_policy' = 'DISCARDED'
    and (metadata->>'converted_customers')::integer > 0;

  if result_record.result <> 'UPDATED'
    or saved_program.program_type <> 'LIFETIME_POINTS'
    or saved_program.status <> 'PAUSED'
    or saved_program.import_stamp_to_point_multiplier <> 3
    or saved_balance.stamp_balance <> balance_before * 3
    or saved_balance.remainder_minor <> 0
    or saved_balance.completed_cycles <> completed_cycles_before
    or reward_count_after <> reward_count_before
    or saved_purchase_rule is distinct from old_purchase_rule
    or conversion_ledger_count <> 1
    or conversion_audit_count <> 1 then
    raise exception 'Existing stamp balances were not migrated safely to points';
  end if;
end;
$$;

reset role;
rollback;
