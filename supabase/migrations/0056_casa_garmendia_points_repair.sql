-- One-time, production-scoped repair for Casa Garmendia PROD.
--
-- The lifetime-points program was configured as MXN $1 per point instead of
-- MXN $10 per point. One MXN $2,000 purchase therefore granted 2,000 points
-- and milestones through 860 instead of the correct 200 points. Keep the
-- purchase and redemption history, but correct the accounting and explicitly
-- reverse/cancel rewards that were only reachable because of the bad rule.

begin;

-- The purchase audit trigger labels every purchase UPDATE as a cancellation.
-- Disable only that audit trigger while correcting the award columns; the DO
-- block writes a dedicated audit event with the complete before/after values.
alter table public.purchases disable trigger purchases_audit_update;

-- Lifetime programs normally prohibit reward cancellation. This trigger is
-- disabled only inside this transaction and only the exact source purchase is
-- updated below. The normal reward audit trigger remains enabled.
alter table public.rewards disable trigger rewards_enforce_program_cancellation_policy;

do $$
declare
  target_tenant_id constant uuid := '0d0f3736-d8cb-48d4-9fcf-f55d433c83c4';
  target_program_id constant uuid := 'd1ee90dc-cf2f-4d14-98d1-603610fa01ee';
  target_customer_id constant uuid := '3855bbdd-acbd-4e92-b484-ecfb6f51889e';
  target_purchase_id constant uuid := 'e7e02fe1-25fc-4a8b-8977-da47b64ff1e4';
  target_ledger_id constant uuid := 'b3845cb9-7a0f-45e7-aea6-bce7f89bbc55';
  target_redemption_id constant uuid := '356d1e99-b492-49c4-9527-fa6242a5f2ee';
  repair_reason constant text := 'Corrección autorizada: la regla debía ser 1 punto por cada MXN $10, no por cada MXN $1.';
  program_record public.loyalty_programs%rowtype;
  purchase_record public.purchases%rowtype;
  balance_record public.customer_loyalty_balances%rowtype;
  ledger_record public.stamp_ledger%rowtype;
begin
  -- Other environments do not contain this production UUID and must remain
  -- untouched when the migration is applied normally.
  if not exists (
    select 1
    from public.tenants tenant
    where tenant.id = target_tenant_id
  ) then
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:casa-garmendia-points-repair-2026-08-24', 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:customer-balance:' || target_customer_id::text, 0)
  );

  select * into program_record
  from public.loyalty_programs
  where id = target_program_id
  for update;

  select * into purchase_record
  from public.purchases
  where id = target_purchase_id
  for update;

  select * into balance_record
  from public.customer_loyalty_balances
  where customer_id = target_customer_id
  for update;

  select * into ledger_record
  from public.stamp_ledger
  where id = target_ledger_id
  for update;

  perform 1
  from public.rewards reward
  where reward.source_purchase_id = target_purchase_id
  for update;

  perform 1
  from public.reward_redemptions redemption
  where redemption.id = target_redemption_id
  for update;

  -- Make the migration safe to retry after the exact repair completed.
  if program_record.amount_per_stamp_minor = 1000
    and purchase_record.stamps_awarded = 200
    and purchase_record.units_awarded_tenths = 2000
    and balance_record.stamp_balance = 200
    and balance_record.lifetime_points_tenths = 2000
    and ledger_record.stamps_delta = 200
    and ledger_record.units_delta_tenths = 2000
    and ledger_record.balance_after = 200
    and ledger_record.balance_after_tenths = 2000
    and (select count(*) from public.rewards where source_purchase_id = target_purchase_id and status = 'AVAILABLE') = 2
    and (select count(*) from public.rewards where source_purchase_id = target_purchase_id and status = 'CANCELLED') = 5
    and exists (
      select 1 from public.reward_redemptions
      where id = target_redemption_id and status = 'REVERSED'
    ) then
    return;
  end if;

  -- Fail closed unless production still matches the state inspected before the
  -- authorized repair. This prevents a concurrent or unrelated record from
  -- being overwritten by a stale one-time migration.
  if not exists (
      select 1 from public.tenants tenant
      where tenant.id = target_tenant_id
        and tenant.name = 'Casa Garmendia PROD'
        and tenant.status = 'ACTIVE'
    )
    or program_record.id is null
    or program_record.tenant_id <> target_tenant_id
    or program_record.program_type <> 'LIFETIME_POINTS'
    or program_record.status <> 'ACTIVE'
    or program_record.rule_type <> 'PER_AMOUNT'
    or program_record.amount_per_stamp_minor <> 100
    or program_record.version <> 4
    or purchase_record.id is null
    or purchase_record.tenant_id <> target_tenant_id
    or purchase_record.customer_id <> target_customer_id
    or purchase_record.program_id <> target_program_id
    or purchase_record.amount_minor <> 200000
    or purchase_record.stamps_awarded <> 2000
    or purchase_record.units_awarded_tenths <> 20000
    or purchase_record.status <> 'CONFIRMED'
    or balance_record.id is null
    or balance_record.tenant_id <> target_tenant_id
    or balance_record.stamp_balance <> 2000
    or balance_record.lifetime_points_tenths <> 20000
    or balance_record.remainder_minor <> 0
    or ledger_record.id is null
    or ledger_record.tenant_id <> target_tenant_id
    or ledger_record.customer_id <> target_customer_id
    or ledger_record.purchase_id <> target_purchase_id
    or ledger_record.entry_type <> 'PURCHASE'
    or ledger_record.stamps_delta <> 2000
    or ledger_record.units_delta_tenths <> 20000
    or ledger_record.balance_after <> 2000
    or ledger_record.balance_after_tenths <> 20000
    or (select count(*) from public.purchases where customer_id = target_customer_id) <> 1
    or (select count(*) from public.stamp_ledger where customer_id = target_customer_id) <> 1
    or (select count(*) from public.rewards where customer_id = target_customer_id) <> 7
    or (select count(*) from public.rewards where source_purchase_id = target_purchase_id) <> 7
    or (select count(*)
        from public.rewards reward
        join public.loyalty_reward_tiers tier on tier.id = reward.reward_tier_id
        where reward.source_purchase_id = target_purchase_id
          and tier.stamps_required in (100, 200)
          and reward.status = 'AVAILABLE') <> 2
    or (select count(*)
        from public.rewards reward
        join public.loyalty_reward_tiers tier on tier.id = reward.reward_tier_id
        where reward.source_purchase_id = target_purchase_id
          and tier.stamps_required in (300, 500, 650, 860)
          and reward.status = 'AVAILABLE') <> 4
    or not exists (
      select 1
      from public.reward_redemptions redemption
      join public.rewards reward on reward.id = redemption.reward_id
      join public.loyalty_reward_tiers tier on tier.id = reward.reward_tier_id
      where redemption.id = target_redemption_id
        and redemption.tenant_id = target_tenant_id
        and redemption.customer_id = target_customer_id
        and redemption.status = 'COMPLETED'
        and reward.source_purchase_id = target_purchase_id
        and reward.status = 'REDEEMED'
        and tier.stamps_required = 400
    )
    or (select count(*) from public.reward_redemptions where customer_id = target_customer_id) <> 1 then
    raise check_violation using
      message = 'Casa Garmendia points repair aborted because production state changed';
  end if;

  update public.loyalty_programs
  set amount_per_stamp_minor = 1000,
      version = version + 1,
      updated_at = now()
  where id = target_program_id;

  update public.purchases
  set stamps_awarded = 200,
      units_awarded_tenths = 2000
  where id = target_purchase_id;

  update public.stamp_ledger
  set stamps_delta = 200,
      units_delta_tenths = 2000,
      balance_after = 200,
      balance_after_tenths = 2000,
      reason = repair_reason
  where id = target_ledger_id;

  update public.customer_loyalty_balances
  set stamp_balance = 200,
      lifetime_points_tenths = 2000,
      updated_at = now()
  where customer_id = target_customer_id;

  update public.reward_redemptions
  set status = 'REVERSED',
      reversed_at = now(),
      reversed_by_staff_id = null,
      reversal_reason = repair_reason
  where id = target_redemption_id;

  update public.rewards reward
  set status = 'CANCELLED',
      redeemed_at = null,
      cancelled_at = now(),
      cancelled_by_staff_id = null,
      cancellation_reason = repair_reason
  from public.loyalty_reward_tiers tier
  where reward.reward_tier_id = tier.id
    and reward.source_purchase_id = target_purchase_id
    and tier.stamps_required > 200;

  insert into public.audit_logs (
    tenant_id,
    actor_staff_id,
    actor_pin_operator_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    target_tenant_id,
    null,
    null,
    'CASA_GARMENDIA_POINTS_RULE_REPAIRED',
    'loyalty_programs',
    target_program_id,
    jsonb_build_object(
      'authorized_one_time_repair', true,
      'amount_per_point_minor_before', 100,
      'amount_per_point_minor_after', 1000,
      'purchase_id', target_purchase_id,
      'purchase_amount_minor', 200000,
      'points_before', 2000,
      'points_after', 200,
      'rewards_kept', 2,
      'rewards_cancelled', 5,
      'redemption_reversed', target_redemption_id
    )
  );
end;
$$;

alter table public.rewards enable trigger rewards_enforce_program_cancellation_policy;
alter table public.purchases enable trigger purchases_audit_update;

commit;
