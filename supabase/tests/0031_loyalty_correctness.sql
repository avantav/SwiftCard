\set ON_ERROR_STOP on

insert into public.customers (
  id,
  tenant_id,
  full_name,
  normalized_phone,
  privacy_consent,
  registration_method,
  source_branch_id,
  created_by_staff_id
)
values
  (
    '30000000-0000-0000-0000-000000000031',
    '10000000-0000-0000-0000-000000000001',
    'Adjustment Reward Customer',
    '+528199999931',
    true,
    'EMPLOYEE',
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000013'
  ),
  (
    '30000000-0000-0000-0000-000000000032',
    '10000000-0000-0000-0000-000000000001',
    'Goal Change Customer',
    '+528199999932',
    true,
    'EMPLOYEE',
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000013'
  ),
  (
    '30000000-0000-0000-0000-000000000033',
    '10000000-0000-0000-0000-000000000001',
    'Expiration Customer',
    '+528199999933',
    true,
    'EMPLOYEE',
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000013'
  ),
  (
    '30000000-0000-0000-0000-000000000034',
    '10000000-0000-0000-0000-000000000001',
    'Paused Adjustment Customer',
    '+528199999934',
    true,
    'EMPLOYEE',
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000013'
  );

insert into public.customer_loyalty_balances (
  tenant_id,
  customer_id,
  stamp_balance
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000031',
    4
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000032',
    12
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000033',
    0
  );

insert into public.customer_cards (
  tenant_id,
  customer_id,
  public_token
)
values (
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000033',
  'loyalty-correctness-public-card-token-000033'
);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare
  result_value text;
begin
  select app.update_loyalty_program(
    (
      select id
      from public.loyalty_programs
      where tenant_id = '10000000-0000-0000-0000-000000000001'
    ),
    'ACTIVE',
    'PER_AMOUNT',
    0,
    1,
    10000,
    true,
    20,
    'Reward 20',
    'Goal twenty reward',
    30
  )
  into result_value;

  if result_value <> 'UPDATED' then
    raise exception 'Program could not be activated for correctness tests';
  end if;
end;
$$;

do $$
declare
  result_value text;
  balance_value integer;
  reward_count integer;
  adjustment_reward_count integer;
  generated_audit_count integer;
begin
  select app.adjust_customer_stamps(
    '30000000-0000-0000-0000-000000000031',
    '20000000-0000-0000-0000-000000000001',
    37,
    'Ajuste positivo con recompensas'
  )
  into result_value;

  select stamp_balance
    into balance_value
  from public.customer_loyalty_balances
  where customer_id = '30000000-0000-0000-0000-000000000031';

  select count(*)
    into reward_count
  from public.rewards
  where customer_id = '30000000-0000-0000-0000-000000000031'
    and source_adjustment_id is not null;

  select rewards_generated
    into adjustment_reward_count
  from public.stamp_adjustments
  where customer_id = '30000000-0000-0000-0000-000000000031'
    and stamps_delta = 37;

  select count(*)
    into generated_audit_count
  from public.audit_logs al
  join public.rewards r on r.id = al.entity_id
  where al.action = 'REWARD_GENERATED'
    and r.customer_id = '30000000-0000-0000-0000-000000000031'
    and al.metadata ->> 'source_adjustment_id' is not null;

  if result_value <> 'ADJUSTED'
    or balance_value <> 1
    or reward_count <> 2
    or adjustment_reward_count <> 2
    or generated_audit_count <> 2 then
    raise exception 'Positive adjustment did not generate rewards and preserve the remainder';
  end if;

  select app.adjust_customer_stamps(
    '30000000-0000-0000-0000-000000000031',
    '20000000-0000-0000-0000-000000000001',
    -2,
    'No debe permitir saldo negativo'
  )
  into result_value;

  if result_value <> 'NEGATIVE_BALANCE' then
    raise exception 'Negative-balance adjustment was accepted';
  end if;

  select app.adjust_customer_stamps(
    '30000000-0000-0000-0000-000000000031',
    '20000000-0000-0000-0000-000000000001',
    -1,
    'Retiro válido'
  )
  into result_value;

  select count(*)
    into reward_count
  from public.rewards
  where customer_id = '30000000-0000-0000-0000-000000000031';

  if result_value <> 'ADJUSTED' or reward_count <> 2 then
    raise exception 'Negative adjustment removed an existing reward';
  end if;
end;
$$;

do $$
declare
  result_value text;
  balance_value integer;
  reward_count integer;
  program_change_ledger_count integer;
begin
  select app.update_loyalty_program(
    (
      select id
      from public.loyalty_programs
      where tenant_id = '10000000-0000-0000-0000-000000000001'
    ),
    'ACTIVE',
    'PER_AMOUNT',
    0,
    1,
    10000,
    true,
    5,
    'Reward 5',
    'Lower goal reward',
    30
  )
  into result_value;

  select stamp_balance
    into balance_value
  from public.customer_loyalty_balances
  where customer_id = '30000000-0000-0000-0000-000000000032';

  select count(*)
    into reward_count
  from public.rewards
  where customer_id = '30000000-0000-0000-0000-000000000032';

  select count(*)
    into program_change_ledger_count
  from public.stamp_ledger
  where customer_id = '30000000-0000-0000-0000-000000000032'
    and entry_type = 'PROGRAM_CHANGE';

  if result_value <> 'UPDATED'
    or balance_value <> 2
    or reward_count <> 2
    or program_change_ledger_count <> 1 then
    raise exception 'Lower reward goal did not generate rewards and preserve the remainder';
  end if;
end;
$$;

do $$
declare
  result_value text;
  balance_row_count integer;
begin
  select app.update_loyalty_program(
    (
      select id
      from public.loyalty_programs
      where tenant_id = '10000000-0000-0000-0000-000000000001'
    ),
    'PAUSED',
    'PER_AMOUNT',
    0,
    1,
    10000,
    true,
    5,
    'Reward 5',
    'Paused reward',
    30
  )
  into result_value;

  if result_value <> 'UPDATED' then
    raise exception 'Program could not be paused';
  end if;

  select app.adjust_customer_stamps(
    '30000000-0000-0000-0000-000000000034',
    '20000000-0000-0000-0000-000000000001',
    1,
    'No debe acumular durante pausa'
  )
  into result_value;

  select count(*)
    into balance_row_count
  from public.customer_loyalty_balances
  where customer_id = '30000000-0000-0000-0000-000000000034';

  if result_value <> 'PROGRAM_PAUSED' or balance_row_count <> 0 then
    raise exception 'Paused program accepted or partially persisted a positive adjustment';
  end if;
end;
$$;

do $$
declare
  result_value text;
begin
  select app.update_loyalty_program(
    (
      select id
      from public.loyalty_programs
      where tenant_id = '10000000-0000-0000-0000-000000000001'
    ),
    'ACTIVE',
    'PER_AMOUNT',
    0,
    1,
    10000,
    true,
    5,
    'Reward 5',
    'Expiration test reward',
    30
  )
  into result_value;

  if result_value <> 'UPDATED' then
    raise exception 'Program could not be resumed';
  end if;
end;
$$;

reset role;

insert into public.rewards (
  id,
  tenant_id,
  customer_id,
  program_id,
  name,
  description,
  expires_at
)
values
  (
    '40000000-0000-0000-0000-000000000031',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000033',
    (
      select id
      from public.loyalty_programs
      where tenant_id = '10000000-0000-0000-0000-000000000001'
    ),
    'Expired target',
    'Must not be redeemable',
    now() - interval '1 day'
  ),
  (
    '40000000-0000-0000-0000-000000000032',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000033',
    (
      select id
      from public.loyalty_programs
      where tenant_id = '10000000-0000-0000-0000-000000000001'
    ),
    'Expired sweep',
    'Must be expired by sweep',
    now() - interval '2 hours'
  ),
  (
    '40000000-0000-0000-0000-000000000033',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000033',
    (
      select id
      from public.loyalty_programs
      where tenant_id = '10000000-0000-0000-0000-000000000001'
    ),
    'Future reward',
    'Must remain visible',
    now() + interval '1 day'
  );

do $$
begin
  begin
    insert into public.rewards (
      tenant_id,
      customer_id,
      program_id,
      source_purchase_id,
      source_adjustment_id,
      name
    )
    values (
      '10000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000031',
      (
        select id
        from public.loyalty_programs
        where tenant_id = '10000000-0000-0000-0000-000000000001'
      ),
      (
        select id
        from public.purchases
        where tenant_id = '10000000-0000-0000-0000-000000000001'
        limit 1
      ),
      (
        select id
        from public.stamp_adjustments
        where customer_id = '30000000-0000-0000-0000-000000000031'
        limit 1
      ),
      'Invalid dual-source reward'
    );
    raise exception 'Reward accepted both purchase and adjustment sources';
  exception
    when check_violation then null;
  end;
end;
$$;

set role anon;

do $$
declare
  card_record record;
begin
  select *
    into card_record
  from app.get_public_web_card('loyalty-correctness-public-card-token-000033');

  if jsonb_array_length(card_record.available_rewards) <> 1
    or card_record.available_rewards -> 0 ->> 'name' <> 'Future reward' then
    raise exception 'Public Web Card exposed an expired reward';
  end if;
end;
$$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', false);

do $$
declare
  result_record record;
  reward_status_value public.reward_status;
  expired_count integer;
begin
  select *
    into result_record
  from app.redeem_reward(
    '40000000-0000-0000-0000-000000000031',
    '20000000-0000-0000-0000-000000000001',
    null,
    null
  );

  select status
    into reward_status_value
  from public.rewards
  where id = '40000000-0000-0000-0000-000000000031';

  if result_record.result <> 'EXPIRED' or reward_status_value <> 'EXPIRED' then
    raise exception 'Expired reward was redeemable';
  end if;

  select app.expire_due_rewards() into expired_count;

  select status
    into reward_status_value
  from public.rewards
  where id = '40000000-0000-0000-0000-000000000032';

  if expired_count < 1 or reward_status_value <> 'EXPIRED' then
    raise exception 'Expiration sweep did not expire due rewards';
  end if;
end;
$$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare
  result_value text;
  cancellation_reason_value text;
  audit_reason text;
  expired_audit_count integer;
  program_audit_count integer;
begin
  select app.cancel_reward(
    '40000000-0000-0000-0000-000000000033',
    'Cancelación con motivo persistido'
  )
  into result_value;

  select cancellation_reason
    into cancellation_reason_value
  from public.rewards
  where id = '40000000-0000-0000-0000-000000000033';

  select metadata ->> 'reason'
    into audit_reason
  from public.audit_logs
  where action = 'REWARD_CANCELLED'
    and entity_id = '40000000-0000-0000-0000-000000000033'
  order by created_at desc
  limit 1;

  select count(*)
    into expired_audit_count
  from public.audit_logs
  where action = 'REWARD_EXPIRED'
    and entity_id in (
      '40000000-0000-0000-0000-000000000031',
      '40000000-0000-0000-0000-000000000032'
    );

  select count(*)
    into program_audit_count
  from public.audit_logs
  where action = 'LOYALTY_PROGRAM_UPDATED'
    and tenant_id = '10000000-0000-0000-0000-000000000001';

  if result_value <> 'CANCELLED'
    or cancellation_reason_value <> 'Cancelación con motivo persistido'
    or audit_reason <> 'Cancelación con motivo persistido'
    or expired_audit_count <> 2
    or program_audit_count < 1 then
    raise exception 'Reward/program audit metadata is incomplete';
  end if;
end;
$$;

reset role;

select 'Loyalty correctness assertions passed' as result;
