\set ON_ERROR_STOP on

begin;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', false);

do $$
declare
  tenant_program_id uuid;
  previous_program_type public.loyalty_program_type;
  result_record record;
  persisted_program_type public.loyalty_program_type;
begin
  select id, program_type
    into tenant_program_id, previous_program_type
  from public.loyalty_programs
  where tenant_id = '10000000-0000-0000-0000-000000000002';

  select * into result_record
  from app.save_loyalty_program_configuration(
    tenant_program_id,
    'Cambio activo inválido',
    'ACTIVE',
    'STAMPS_PER_AMOUNT',
    'PER_AMOUNT',
    0,
    1,
    1000,
    true,
    'El cambio de tipo debe guardarse primero con el programa pausado.',
    '[{"stamps_required": 100, "name": "Premio", "description": "Premio futuro", "expiration_days": null}]'::jsonb,
    'sello',
    'sellos',
    false,
    null,
    null,
    null,
    false,
    1,
    true,
    true,
    true
  );

  select program_type
    into persisted_program_type
  from public.loyalty_programs
  where id = tenant_program_id;

  if result_record.result <> 'INVALID'
    or persisted_program_type is distinct from previous_program_type then
    raise exception 'An active program type transition bypassed the paused boundary';
  end if;
end;
$$;

do $$
declare
  tenant_program_id uuid;
  old_program_type public.loyalty_program_type;
  old_purchase_rule public.loyalty_rule_type;
  balance_before integer;
  reward_count_before integer;
  result_record record;
  saved_program record;
  saved_balance integer;
  saved_purchase_rule public.loyalty_rule_type;
  reward_count_after integer;
  audit_count integer;
begin
  select id, program_type
    into tenant_program_id, old_program_type
  from public.loyalty_programs
  where tenant_id = '10000000-0000-0000-0000-000000000002';

  select rule_type
    into old_purchase_rule
  from public.purchases
  where tenant_id = '10000000-0000-0000-0000-000000000002'
  order by created_at
  limit 1;

  select stamp_balance
    into balance_before
  from public.customer_loyalty_balances
  where tenant_id = '10000000-0000-0000-0000-000000000002'
  order by customer_id
  limit 1;

  select count(*)
    into reward_count_before
  from public.rewards
  where tenant_id = '10000000-0000-0000-0000-000000000002';

  select * into result_record
  from app.save_loyalty_program_configuration(
    tenant_program_id,
    'Programa por monto',
    'PAUSED',
    'STAMPS_PER_AMOUNT',
    'PER_AMOUNT',
    0,
    1,
    1000,
    true,
    'La nueva regla aplica únicamente a compras futuras del programa.',
    '[{"stamps_required": 100, "name": "Premio", "description": "Premio futuro", "expiration_days": null}]'::jsonb,
    'sello',
    'sellos',
    false,
    null,
    null,
    null,
    false,
    1,
    true,
    true,
    true
  );

  select *
    into saved_program
  from public.loyalty_programs
  where id = tenant_program_id;

  select stamp_balance
    into saved_balance
  from public.customer_loyalty_balances
  where tenant_id = '10000000-0000-0000-0000-000000000002'
  order by customer_id
  limit 1;

  select rule_type
    into saved_purchase_rule
  from public.purchases
  where tenant_id = '10000000-0000-0000-0000-000000000002'
  order by created_at
  limit 1;

  select count(*)
    into reward_count_after
  from public.rewards
  where tenant_id = '10000000-0000-0000-0000-000000000002';

  select count(*)
    into audit_count
  from public.audit_logs
  where tenant_id = '10000000-0000-0000-0000-000000000002'
    and entity_id = tenant_program_id
    and action = 'LOYALTY_PROGRAM_TYPE_CHANGED'
    and metadata->>'previous_program_type' = old_program_type::text
    and metadata->>'new_program_type' = 'STAMPS_PER_AMOUNT'
    and metadata->>'effective_scope' = 'FUTURE_PURCHASES';

  if result_record.result <> 'UPDATED'
    or saved_program.program_type <> 'STAMPS_PER_AMOUNT'
    or saved_program.rule_type <> 'PER_AMOUNT'
    or saved_program.status <> 'PAUSED'
    or saved_balance is distinct from balance_before
    or saved_purchase_rule is distinct from old_purchase_rule
    or reward_count_after <> reward_count_before
    or audit_count <> 1 then
    raise exception 'Admin program type change did not preserve history and balances';
  end if;
end;
$$;

reset role;
rollback;

select 'Admin program type change assertions passed' as result;
