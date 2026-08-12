-- Add an explicit program type and tenant-owned operating options without
-- changing the behavior of existing loyalty calculations.

create type public.loyalty_program_type as enum (
  'STAMPS_PER_PURCHASE',
  'STAMPS_PER_AMOUNT',
  'LIFETIME_POINTS'
);

alter table public.loyalty_programs
  add column program_type public.loyalty_program_type,
  add column unit_name_singular text not null default 'sello',
  add column unit_name_plural text not null default 'sellos',
  add column welcome_reward_enabled boolean not null default false,
  add column welcome_reward_name text,
  add column welcome_reward_description text,
  add column welcome_reward_expiration_days integer,
  add column grant_welcome_reward_to_imports boolean not null default false,
  add column import_stamp_to_point_multiplier integer not null default 1,
  add column allow_purchase_cancellations boolean not null default true,
  add column allow_reward_cancellations boolean not null default true,
  add column allow_redemption_reversals boolean not null default true;

update public.loyalty_programs
set program_type = case rule_type
  when 'PER_PURCHASE' then 'STAMPS_PER_PURCHASE'::public.loyalty_program_type
  else 'STAMPS_PER_AMOUNT'::public.loyalty_program_type
end;

alter table public.loyalty_programs
  alter column program_type set not null,
  alter column program_type set default 'STAMPS_PER_PURCHASE',
  add constraint loyalty_programs_unit_singular_length check (
    length(btrim(unit_name_singular)) between 1 and 24
  ),
  add constraint loyalty_programs_unit_plural_length check (
    length(btrim(unit_name_plural)) between 1 and 24
  ),
  add constraint loyalty_programs_welcome_reward_consistency check (
    (
      not welcome_reward_enabled
      and welcome_reward_expiration_days is null
    )
    or (
      welcome_reward_enabled
      and coalesce(length(btrim(welcome_reward_name)), 0) between 1 and 120
      and welcome_reward_description is not null
      and length(welcome_reward_description) <= 500
      and (
        welcome_reward_expiration_days is null
        or welcome_reward_expiration_days between 1 and 3650
      )
    )
  ),
  add constraint loyalty_programs_import_multiplier_positive check (
    import_stamp_to_point_multiplier between 1 and 1000000
  );

-- Reward catalogs have no product-level count limit. Per-tier size and value
-- constraints remain bounded, and the request body is still bounded by the
-- application/server runtime.
create or replace function app.reward_tiers_are_valid(target_reward_tiers jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  tier_count integer;
  distinct_stamps integer;
  invalid_count integer;
begin
  if jsonb_typeof(target_reward_tiers) <> 'array' then
    return false;
  end if;

  tier_count := jsonb_array_length(target_reward_tiers);
  if tier_count < 1 then
    return false;
  end if;

  select
    count(distinct tier.stamps_required),
    count(*) filter (
      where tier.stamps_required not between 1 and 1000000
        or coalesce(length(btrim(tier.name)), 0) not between 1 and 120
        or tier.description is null
        or length(tier.description) > 500
        or (
          tier.expiration_days is not null
          and tier.expiration_days not between 1 and 3650
        )
    )
    into distinct_stamps, invalid_count
  from jsonb_to_recordset(target_reward_tiers) as tier(
    stamps_required integer,
    name text,
    description text,
    expiration_days integer
  );

  return distinct_stamps = tier_count and invalid_count = 0;
exception
  when others then
    return false;
end;
$$;

create function app.save_loyalty_program_configuration(
  target_program_id uuid,
  target_name text,
  target_status public.loyalty_program_status,
  target_program_type public.loyalty_program_type,
  target_rule_type public.loyalty_rule_type,
  target_minimum_purchase_minor bigint,
  target_stamps_per_purchase integer,
  target_amount_per_stamp_minor bigint,
  target_carry_remainder boolean,
  target_terms_and_conditions text,
  target_reward_tiers jsonb,
  target_unit_name_singular text,
  target_unit_name_plural text,
  target_welcome_reward_enabled boolean,
  target_welcome_reward_name text,
  target_welcome_reward_description text,
  target_welcome_reward_expiration_days integer,
  target_grant_welcome_reward_to_imports boolean,
  target_import_stamp_to_point_multiplier integer,
  target_allow_purchase_cancellations boolean,
  target_allow_reward_cancellations boolean,
  target_allow_redemption_reversals boolean
)
returns table (result text, saved_program_id uuid)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  existing_program record;
  save_record record;
begin
  select sp.id, sp.tenant_id
    into staff_record
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
    and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE'
    and t.status = 'ACTIVE';

  if staff_record.id is null or staff_record.tenant_id is null then
    return query select 'UNAVAILABLE', null::uuid;
    return;
  end if;

  if target_program_type is null
    or target_unit_name_singular is null
    or length(btrim(target_unit_name_singular)) not between 1 and 24
    or target_unit_name_plural is null
    or length(btrim(target_unit_name_plural)) not between 1 and 24
    or target_welcome_reward_enabled is null
    or target_grant_welcome_reward_to_imports is null
    or target_import_stamp_to_point_multiplier not between 1 and 1000000
    or target_allow_purchase_cancellations is null
    or target_allow_reward_cancellations is null
    or target_allow_redemption_reversals is null
    or (
      target_program_type = 'LIFETIME_POINTS'
      and target_status <> 'PAUSED'
    )
    or (
      target_program_type = 'STAMPS_PER_PURCHASE'
      and target_rule_type <> 'PER_PURCHASE'
    )
    or (
      target_program_type in ('STAMPS_PER_AMOUNT', 'LIFETIME_POINTS')
      and target_rule_type <> 'PER_AMOUNT'
    )
    or (
      target_welcome_reward_enabled
      and (
        coalesce(length(btrim(target_welcome_reward_name)), 0) not between 1 and 120
        or target_welcome_reward_description is null
        or length(target_welcome_reward_description) > 500
        or (
          target_welcome_reward_expiration_days is not null
          and target_welcome_reward_expiration_days not between 1 and 3650
        )
      )
    )
    or (
      not target_welcome_reward_enabled
      and target_welcome_reward_expiration_days is not null
    ) then
    return query select 'INVALID', null::uuid;
    return;
  end if;

  if target_program_id is not null then
    select lp.id, lp.tenant_id, lp.program_type
      into existing_program
    from public.loyalty_programs lp
    where lp.id = target_program_id;

    if existing_program.id is null
      or existing_program.tenant_id is distinct from staff_record.tenant_id then
      return query select 'UNAVAILABLE', null::uuid;
      return;
    end if;

    if existing_program.program_type is distinct from target_program_type
      and (
        exists (
          select 1 from public.purchases p
          where p.tenant_id = staff_record.tenant_id
        )
        or exists (
          select 1 from public.rewards r
          where r.tenant_id = staff_record.tenant_id
        )
        or exists (
          select 1 from public.customer_loyalty_balances clb
          where clb.tenant_id = staff_record.tenant_id
            and (clb.stamp_balance <> 0 or clb.remainder_minor <> 0)
        )
      ) then
      return query select 'TYPE_LOCKED', target_program_id;
      return;
    end if;
  end if;

  select *
    into save_record
  from app.save_loyalty_program_with_tiers(
    target_program_id,
    target_name,
    target_status,
    target_rule_type,
    target_minimum_purchase_minor,
    target_stamps_per_purchase,
    target_amount_per_stamp_minor,
    target_carry_remainder,
    target_terms_and_conditions,
    target_reward_tiers
  );

  if save_record.result not in ('CREATED', 'UPDATED') then
    return query select save_record.result, save_record.saved_program_id;
    return;
  end if;

  update public.loyalty_programs
  set program_type = target_program_type,
      unit_name_singular = btrim(target_unit_name_singular),
      unit_name_plural = btrim(target_unit_name_plural),
      welcome_reward_enabled = target_welcome_reward_enabled,
      welcome_reward_name = case
        when target_welcome_reward_enabled then btrim(target_welcome_reward_name)
        else null
      end,
      welcome_reward_description = case
        when target_welcome_reward_enabled then btrim(target_welcome_reward_description)
        else null
      end,
      welcome_reward_expiration_days = case
        when target_welcome_reward_enabled then target_welcome_reward_expiration_days
        else null
      end,
      grant_welcome_reward_to_imports = target_grant_welcome_reward_to_imports,
      import_stamp_to_point_multiplier = target_import_stamp_to_point_multiplier,
      allow_purchase_cancellations = target_allow_purchase_cancellations,
      allow_reward_cancellations = target_allow_reward_cancellations,
      allow_redemption_reversals = target_allow_redemption_reversals,
      updated_at = now()
  where id = save_record.saved_program_id
    and tenant_id = staff_record.tenant_id;

  insert into public.audit_logs (
    tenant_id,
    actor_staff_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    staff_record.tenant_id,
    staff_record.id,
    'LOYALTY_PROGRAM_OPTIONS_CONFIGURED',
    'loyalty_programs',
    save_record.saved_program_id,
    jsonb_build_object(
      'program_type', target_program_type,
      'unit_name_singular', btrim(target_unit_name_singular),
      'unit_name_plural', btrim(target_unit_name_plural),
      'welcome_reward_enabled', target_welcome_reward_enabled,
      'grant_welcome_reward_to_imports', target_grant_welcome_reward_to_imports,
      'import_stamp_to_point_multiplier', target_import_stamp_to_point_multiplier,
      'allow_purchase_cancellations', target_allow_purchase_cancellations,
      'allow_reward_cancellations', target_allow_reward_cancellations,
      'allow_redemption_reversals', target_allow_redemption_reversals
    )
  );

  return query select save_record.result, save_record.saved_program_id;
exception
  when check_violation
    or not_null_violation
    or invalid_text_representation
    or numeric_value_out_of_range then
    return query select 'INVALID', null::uuid;
end;
$$;

revoke all on function app.save_loyalty_program_configuration(
  uuid,
  text,
  public.loyalty_program_status,
  public.loyalty_program_type,
  public.loyalty_rule_type,
  bigint,
  integer,
  bigint,
  boolean,
  text,
  jsonb,
  text,
  text,
  boolean,
  text,
  text,
  integer,
  boolean,
  integer,
  boolean,
  boolean,
  boolean
) from public, anon;

grant execute on function app.save_loyalty_program_configuration(
  uuid,
  text,
  public.loyalty_program_status,
  public.loyalty_program_type,
  public.loyalty_rule_type,
  bigint,
  integer,
  bigint,
  boolean,
  text,
  jsonb,
  text,
  text,
  boolean,
  text,
  text,
  integer,
  boolean,
  integer,
  boolean,
  boolean,
  boolean
) to authenticated;
