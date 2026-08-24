-- Complete the card-scoped welcome reward flow. Configuration stays on the
-- owning program, while issuance is tied to the first card creation so every
-- registration path receives the same one-time behavior.

alter table public.rewards
  add column is_welcome_reward boolean not null default false,
  add constraint rewards_welcome_card_required check (
    not is_welcome_reward or loyalty_card_id is not null
  );

create unique index rewards_customer_card_welcome_once_idx
  on public.rewards (customer_id, loyalty_card_id)
  where is_welcome_reward;

alter function app.save_loyalty_card_program(
  uuid, text, public.loyalty_program_type, public.loyalty_rule_type,
  bigint, integer, bigint, boolean, text, jsonb, text, text
) rename to save_loyalty_card_program_core_0054;

revoke all on function app.save_loyalty_card_program_core_0054(
  uuid, text, public.loyalty_program_type, public.loyalty_rule_type,
  bigint, integer, bigint, boolean, text, jsonb, text, text
) from public, anon, authenticated;

create function app.save_loyalty_card_program(
  target_card_id uuid,
  target_name text,
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
  target_welcome_reward_expiration_days integer
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  save_result text;
  saved_program_id uuid;
begin
  if target_welcome_reward_enabled is null
    or (
      target_welcome_reward_enabled
      and (
        coalesce(length(btrim(target_welcome_reward_name)), 0) not between 1 and 120
        or coalesce(length(btrim(target_welcome_reward_description)), 0) not between 1 and 500
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
    return 'INVALID';
  end if;

  save_result := app.save_loyalty_card_program_core_0054(
    target_card_id,
    target_name,
    target_program_type,
    target_rule_type,
    target_minimum_purchase_minor,
    target_stamps_per_purchase,
    target_amount_per_stamp_minor,
    target_carry_remainder,
    target_terms_and_conditions,
    target_reward_tiers,
    target_unit_name_singular,
    target_unit_name_plural
  );

  if save_result <> 'SAVED' then
    return save_result;
  end if;

  update public.loyalty_programs program
  set welcome_reward_enabled = target_welcome_reward_enabled,
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
      updated_at = now()
  from public.loyalty_cards card
  where card.id = target_card_id
    and card.program_id = program.id
    and card.tenant_id = app.current_staff_tenant_id()
    and app.current_staff_role() = 'ADMIN'
  returning program.id into saved_program_id;

  if saved_program_id is null then
    raise check_violation using message = 'Saved loyalty card program is unavailable';
  end if;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  )
  select
    card.tenant_id,
    auth.uid(),
    'LOYALTY_CARD_WELCOME_REWARD_CONFIGURED',
    'loyalty_programs',
    saved_program_id,
    jsonb_build_object(
      'loyalty_card_id', card.id,
      'enabled', target_welcome_reward_enabled,
      'has_expiration', target_welcome_reward_expiration_days is not null
    )
  from public.loyalty_cards card
  where card.id = target_card_id;

  return 'SAVED';
exception
  when check_violation or not_null_violation or numeric_value_out_of_range then
    return 'INVALID';
end;
$$;

revoke all on function app.save_loyalty_card_program(
  uuid, text, public.loyalty_program_type, public.loyalty_rule_type,
  bigint, integer, bigint, boolean, text, jsonb, text, text,
  boolean, text, text, integer
) from public, anon, authenticated;
grant execute on function app.save_loyalty_card_program(
  uuid, text, public.loyalty_program_type, public.loyalty_rule_type,
  bigint, integer, bigint, boolean, text, jsonb, text, text,
  boolean, text, text, integer
) to authenticated;

-- Preserve the prior callable signature for already deployed application
-- versions while retaining the card's current welcome configuration.
create function app.save_loyalty_card_program(
  target_card_id uuid,
  target_name text,
  target_program_type public.loyalty_program_type,
  target_rule_type public.loyalty_rule_type,
  target_minimum_purchase_minor bigint,
  target_stamps_per_purchase integer,
  target_amount_per_stamp_minor bigint,
  target_carry_remainder boolean,
  target_terms_and_conditions text,
  target_reward_tiers jsonb,
  target_unit_name_singular text,
  target_unit_name_plural text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  welcome_record record;
begin
  select
    program.welcome_reward_enabled,
    program.welcome_reward_name,
    program.welcome_reward_description,
    program.welcome_reward_expiration_days
  into welcome_record
  from public.loyalty_cards card
  join public.loyalty_programs program on program.id = card.program_id
  where card.id = target_card_id;

  return app.save_loyalty_card_program(
    target_card_id,
    target_name,
    target_program_type,
    target_rule_type,
    target_minimum_purchase_minor,
    target_stamps_per_purchase,
    target_amount_per_stamp_minor,
    target_carry_remainder,
    target_terms_and_conditions,
    target_reward_tiers,
    target_unit_name_singular,
    target_unit_name_plural,
    coalesce(welcome_record.welcome_reward_enabled, false),
    welcome_record.welcome_reward_name,
    welcome_record.welcome_reward_description,
    welcome_record.welcome_reward_expiration_days
  );
end;
$$;

revoke all on function app.save_loyalty_card_program(
  uuid, text, public.loyalty_program_type, public.loyalty_rule_type,
  bigint, integer, bigint, boolean, text, jsonb, text, text
) from public, anon, authenticated;
grant execute on function app.save_loyalty_card_program(
  uuid, text, public.loyalty_program_type, public.loyalty_rule_type,
  bigint, integer, bigint, boolean, text, jsonb, text, text
) to authenticated;

create function app.grant_welcome_reward_on_card_issue()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  insert into public.rewards (
    tenant_id,
    customer_id,
    program_id,
    name,
    description,
    expires_at,
    stamps_required_snapshot,
    program_version_snapshot,
    loyalty_card_id,
    is_welcome_reward
  )
  select
    new.tenant_id,
    new.customer_id,
    program.id,
    btrim(program.welcome_reward_name),
    btrim(program.welcome_reward_description),
    case when program.welcome_reward_expiration_days is null then null
      else now() + make_interval(days => program.welcome_reward_expiration_days)
    end,
    0,
    program.version,
    card.id,
    true
  from public.customers customer
  left join public.customer_imports import_record
    on import_record.id = customer.customer_import_id
  join public.loyalty_cards card
    on card.id = new.loyalty_card_id
   and card.tenant_id = new.tenant_id
   and card.status = 'PUBLISHED'
  join public.loyalty_programs program
    on program.id = card.program_id
   and program.tenant_id = new.tenant_id
   and program.welcome_reward_enabled
  where customer.id = new.customer_id
    and customer.tenant_id = new.tenant_id
    and (
      customer.customer_import_id is null
      or (
        program.grant_welcome_reward_to_imports
        and import_record.import_profile_code is distinct from
          'CASA_GARMENDIA_LEGACY_STAMPS_2026'
      )
    )
  on conflict (customer_id, loyalty_card_id) where is_welcome_reward
    do nothing;

  return new;
end;
$$;

revoke all on function app.grant_welcome_reward_on_card_issue()
  from public, anon, authenticated;

create trigger customer_cards_grant_welcome_reward
  after insert on public.customer_cards
  for each row execute function app.grant_welcome_reward_on_card_issue();
