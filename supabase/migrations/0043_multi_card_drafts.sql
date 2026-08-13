-- Multi-card foundation: each tenant can configure up to three cards. Every
-- card owns exactly one loyalty program, one provider-neutral design, and one
-- or more participating branches. Drafts are durable until publication.

create type public.loyalty_card_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');

drop index if exists public.loyalty_programs_one_active_per_tenant_idx;

create table public.loyalty_cards (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  program_id uuid not null unique references public.loyalty_programs(id) on delete restrict,
  name text not null,
  status public.loyalty_card_status not null default 'DRAFT',
  program_completed boolean not null default false,
  design_completed boolean not null default false,
  locations_completed boolean not null default false,
  current_step smallint not null default 1,
  wallet_enabled boolean not null default false,
  logo_text text not null,
  description text not null,
  background_color text not null,
  foreground_color text not null default '#FFFFFF',
  label_color text not null default '#FFFFFF',
  logo_image_url text,
  strip_image_url text,
  published_at timestamptz,
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  updated_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_cards_name_length check (length(btrim(name)) between 1 and 80),
  constraint loyalty_cards_logo_text_length check (length(btrim(logo_text)) between 1 and 60),
  constraint loyalty_cards_description_length check (length(btrim(description)) between 1 and 120),
  constraint loyalty_cards_background_color check (background_color ~ '^#[0-9A-F]{6}$'),
  constraint loyalty_cards_foreground_color check (foreground_color ~ '^#[0-9A-F]{6}$'),
  constraint loyalty_cards_label_color check (label_color ~ '^#[0-9A-F]{6}$'),
  constraint loyalty_cards_logo_image_https check (logo_image_url is null or logo_image_url ~ '^https://'),
  constraint loyalty_cards_strip_image_https check (strip_image_url is null or strip_image_url ~ '^https://'),
  constraint loyalty_cards_current_step_range check (current_step between 1 and 4),
  constraint loyalty_cards_publication_consistency check (
    (status = 'PUBLISHED' and published_at is not null)
    or (status <> 'PUBLISHED')
  )
);

create table public.loyalty_card_branches (
  loyalty_card_id uuid not null references public.loyalty_cards(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (loyalty_card_id, branch_id)
);

create index loyalty_cards_tenant_status_idx
  on public.loyalty_cards (tenant_id, status, updated_at desc);
create index loyalty_card_branches_branch_idx
  on public.loyalty_card_branches (branch_id, loyalty_card_id);

create or replace function app.enforce_loyalty_card_limit()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:tenant-cards:' || new.tenant_id::text, 0)
  );

  if new.status <> 'ARCHIVED' and (
    select count(*)
    from public.loyalty_cards card
    where card.tenant_id = new.tenant_id
      and card.status <> 'ARCHIVED'
      and card.id <> new.id
  ) >= 3 then
    raise check_violation using message = 'A tenant can have at most three cards';
  end if;

  return new;
end;
$$;

create or replace function app.enforce_loyalty_card_tenant_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  related_tenant_id uuid;
begin
  select lp.tenant_id into related_tenant_id
  from public.loyalty_programs lp
  where lp.id = new.program_id;

  if related_tenant_id is distinct from new.tenant_id then
    raise check_violation using message = 'Card program tenant must match';
  end if;

  return new;
end;
$$;

create or replace function app.enforce_loyalty_card_branch_tenant_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  card_tenant_id uuid;
  branch_tenant_id uuid;
begin
  select tenant_id into card_tenant_id from public.loyalty_cards where id = new.loyalty_card_id;
  select tenant_id into branch_tenant_id from public.branches where id = new.branch_id;
  if card_tenant_id is distinct from new.tenant_id
    or branch_tenant_id is distinct from new.tenant_id then
    raise check_violation using message = 'Card branch tenant must match';
  end if;
  return new;
end;
$$;

create trigger loyalty_cards_limit
  before insert or update of tenant_id, status on public.loyalty_cards
  for each row execute function app.enforce_loyalty_card_limit();
create trigger loyalty_cards_tenant_consistency
  before insert or update of tenant_id, program_id on public.loyalty_cards
  for each row execute function app.enforce_loyalty_card_tenant_consistency();
create trigger loyalty_card_branches_tenant_consistency
  before insert or update on public.loyalty_card_branches
  for each row execute function app.enforce_loyalty_card_branch_tenant_consistency();
create trigger loyalty_cards_set_updated_at
  before update on public.loyalty_cards
  for each row execute function app.set_updated_at();

-- Tenants with issued cards but no program receive a paused compatibility
-- program so every existing issued card can be attached without data loss.
insert into public.loyalty_programs (
  tenant_id, name, status, rule_type, minimum_purchase_minor,
  stamps_per_purchase, amount_per_stamp_minor, carry_remainder,
  reward_stamp_goal, reward_name, reward_description,
  terms_and_conditions, program_type
)
select distinct
  cc.tenant_id,
  'Programa de fidelidad',
  'PAUSED'::public.loyalty_program_status,
  'PER_PURCHASE'::public.loyalty_rule_type,
  0,
  1,
  null::bigint,
  true,
  10,
  'Recompensa',
  'Beneficio al completar la tarjeta',
  'Consulta los términos y condiciones vigentes con el negocio.',
  'STAMPS_PER_PURCHASE'::public.loyalty_program_type
from public.customer_cards cc
where not exists (
  select 1 from public.loyalty_programs lp where lp.tenant_id = cc.tenant_id
);

insert into public.loyalty_reward_tiers (
  tenant_id, program_id, stamps_required, name, description
)
select lp.tenant_id, lp.id, lp.reward_stamp_goal, lp.reward_name, lp.reward_description
from public.loyalty_programs lp
where not exists (
  select 1 from public.loyalty_reward_tiers tier where tier.program_id = lp.id
)
on conflict (program_id, stamps_required) do nothing;

with selected_programs as (
  select distinct on (lp.tenant_id) lp.*
  from public.loyalty_programs lp
  order by lp.tenant_id, (lp.status = 'ACTIVE') desc, lp.updated_at desc, lp.id
)
insert into public.loyalty_cards (
  tenant_id, program_id, name, status,
  program_completed, design_completed, locations_completed, current_step,
  wallet_enabled, logo_text, description,
  background_color, foreground_color, label_color,
  logo_image_url, strip_image_url, published_at
)
select
  program.tenant_id,
  program.id,
  left(program.name, 80),
  'PUBLISHED',
  true,
  true,
  true,
  4,
  coalesce(design.apple_enabled, false),
  left(coalesce(design.logo_text, tenant.name), 60),
  left(coalesce(design.description, 'Tarjeta de recompensas de ' || tenant.name), 120),
  upper(coalesce(design.background_color, tenant.secondary_color, '#0F766E')),
  upper(coalesce(design.foreground_color, '#FFFFFF')),
  upper(coalesce(design.label_color, '#FFFFFF')),
  coalesce(design.logo_image_url, tenant.logo_url),
  coalesce(design.strip_image_url, tenant.banner_url),
  now()
from selected_programs program
join public.tenants tenant on tenant.id = program.tenant_id
left join public.tenant_wallet_designs design on design.tenant_id = program.tenant_id;

insert into public.loyalty_card_branches (loyalty_card_id, branch_id, tenant_id)
select card.id, branch.id, card.tenant_id
from public.loyalty_cards card
join public.branches branch on branch.tenant_id = card.tenant_id
on conflict do nothing;

alter table public.customer_cards
  add column loyalty_card_id uuid references public.loyalty_cards(id) on delete restrict;

update public.customer_cards issued
set loyalty_card_id = card.id
from public.loyalty_cards card
where card.tenant_id = issued.tenant_id
  and card.status = 'PUBLISHED';

alter table public.purchases
  add column loyalty_card_id uuid references public.loyalty_cards(id) on delete restrict,
  add column program_id uuid references public.loyalty_programs(id) on delete restrict;
update public.purchases purchase
set loyalty_card_id = issued.loyalty_card_id,
    program_id = card.program_id
from public.customer_cards issued, public.loyalty_cards card
where issued.customer_id = purchase.customer_id
  and issued.tenant_id = purchase.tenant_id
  and card.id = issued.loyalty_card_id;

alter table public.stamp_ledger
  add column loyalty_card_id uuid references public.loyalty_cards(id) on delete restrict;
update public.stamp_ledger ledger
set loyalty_card_id = issued.loyalty_card_id
from public.customer_cards issued
where issued.customer_id = ledger.customer_id
  and issued.tenant_id = ledger.tenant_id;

alter table public.stamp_adjustments
  add column loyalty_card_id uuid references public.loyalty_cards(id) on delete restrict;
update public.stamp_adjustments adjustment
set loyalty_card_id = issued.loyalty_card_id
from public.customer_cards issued
where issued.customer_id = adjustment.customer_id
  and issued.tenant_id = adjustment.tenant_id;

alter table public.rewards
  add column loyalty_card_id uuid references public.loyalty_cards(id) on delete restrict;
update public.rewards reward
set loyalty_card_id = card.id
from public.loyalty_cards card
where card.program_id = reward.program_id;

create index customer_cards_loyalty_card_idx on public.customer_cards (loyalty_card_id, status);
create index purchases_loyalty_card_created_idx on public.purchases (loyalty_card_id, created_at desc);
create index rewards_loyalty_card_status_idx on public.rewards (loyalty_card_id, status);

create or replace function app.fill_loyalty_card_scope()
returns trigger
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  if tg_table_name = 'rewards' then
    if new.loyalty_card_id is null then
      select card.id into new.loyalty_card_id
      from public.loyalty_cards card
      where card.program_id = new.program_id;
    end if;
  elsif new.loyalty_card_id is null then
    select issued.loyalty_card_id into new.loyalty_card_id
    from public.customer_cards issued
    where issued.customer_id = new.customer_id and issued.status = 'ACTIVE';
  end if;
  if tg_table_name = 'purchases' then
    if new.program_id is null then
      select card.program_id into new.program_id
      from public.loyalty_cards card where card.id = new.loyalty_card_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger purchases_fill_loyalty_card_scope
  before insert on public.purchases for each row execute function app.fill_loyalty_card_scope();
create trigger stamp_ledger_fill_loyalty_card_scope
  before insert on public.stamp_ledger for each row execute function app.fill_loyalty_card_scope();
create trigger stamp_adjustments_fill_loyalty_card_scope
  before insert on public.stamp_adjustments for each row execute function app.fill_loyalty_card_scope();
create trigger rewards_fill_loyalty_card_scope
  before insert on public.rewards for each row execute function app.fill_loyalty_card_scope();

alter table public.loyalty_cards enable row level security;
alter table public.loyalty_cards force row level security;
alter table public.loyalty_card_branches enable row level security;
alter table public.loyalty_card_branches force row level security;

create policy loyalty_cards_staff_read on public.loyalty_cards
  for select to authenticated
  using (app.is_superadmin() or app.current_staff_can_manage_tenant(tenant_id));
create policy loyalty_card_branches_staff_read on public.loyalty_card_branches
  for select to authenticated
  using (app.is_superadmin() or app.current_staff_can_manage_tenant(tenant_id));

revoke all on public.loyalty_cards, public.loyalty_card_branches from public, anon, authenticated;
grant select on public.loyalty_cards, public.loyalty_card_branches to authenticated;

create function app.create_loyalty_card_draft(target_name text)
returns table (result text, loyalty_card_id uuid)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  tenant_record record;
  program_id_value uuid;
  card_id_value uuid;
  normalized_name text := btrim(target_name);
begin
  select sp.id, sp.tenant_id, t.name as tenant_name, t.secondary_color,
         t.logo_url, t.banner_url
  into staff_record
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid() and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE' and t.status = 'ACTIVE';

  if staff_record.id is null or length(normalized_name) not between 1 and 80 then
    return query select 'INVALID', null::uuid;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:tenant-cards:' || staff_record.tenant_id::text, 0)
  );
  if (select count(*) from public.loyalty_cards
      where tenant_id = staff_record.tenant_id and status <> 'ARCHIVED') >= 3 then
    return query select 'LIMIT_REACHED', null::uuid;
    return;
  end if;

  insert into public.loyalty_programs (
    tenant_id, name, status, rule_type, minimum_purchase_minor,
    stamps_per_purchase, amount_per_stamp_minor, carry_remainder,
    reward_stamp_goal, reward_name, reward_description,
    terms_and_conditions, program_type
  ) values (
    staff_record.tenant_id, normalized_name, 'PAUSED', 'PER_PURCHASE', 0,
    1, null, true, 10, 'Recompensa',
    'Beneficio al completar la tarjeta',
    'Consulta los términos y condiciones vigentes con el negocio.',
    'STAMPS_PER_PURCHASE'
  ) returning id into program_id_value;

  insert into public.loyalty_cards (
    tenant_id, program_id, name, logo_text, description,
    background_color, foreground_color, label_color,
    logo_image_url, strip_image_url,
    created_by_staff_id, updated_by_staff_id
  ) values (
    staff_record.tenant_id, program_id_value, normalized_name,
    left(staff_record.tenant_name, 60),
    left('Tarjeta de recompensas de ' || staff_record.tenant_name, 120),
    upper(coalesce(staff_record.secondary_color, '#0F766E')),
    '#FFFFFF', '#FFFFFF',
    case when staff_record.logo_url ~ '^https://' then staff_record.logo_url else null end,
    case when staff_record.banner_url ~ '^https://' then staff_record.banner_url else null end,
    staff_record.id, staff_record.id
  ) returning id into card_id_value;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    staff_record.tenant_id, staff_record.id, 'LOYALTY_CARD_DRAFT_CREATED',
    'loyalty_cards', card_id_value, jsonb_build_object('name', normalized_name)
  );

  return query select 'CREATED', card_id_value;
exception when check_violation or unique_violation then
  return query select 'INVALID', null::uuid;
end;
$$;

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
  staff_record record;
  card_record record;
  top_tier record;
begin
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid() and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE' and t.status = 'ACTIVE';
  select card.* into card_record from public.loyalty_cards card
  where card.id = target_card_id and card.tenant_id = staff_record.tenant_id
    and card.status <> 'ARCHIVED' for update;

  if staff_record.id is null or card_record.id is null
    or coalesce(length(btrim(target_name)), 0) not between 1 and 80
    or target_program_type = 'LIFETIME_POINTS'
    or target_rule_type is null
    or coalesce(length(btrim(target_terms_and_conditions)), 0) not between 10 and 4000
    or coalesce(length(btrim(target_unit_name_singular)), 0) not between 1 and 24
    or coalesce(length(btrim(target_unit_name_plural)), 0) not between 1 and 24
    or target_minimum_purchase_minor not between 0 and 9007199254740991
    or target_stamps_per_purchase not between 1 and 1000000
    or not app.reward_tiers_are_valid(target_reward_tiers)
    or not coalesce(
      (target_rule_type = 'PER_PURCHASE' and target_program_type = 'STAMPS_PER_PURCHASE'
        and target_amount_per_stamp_minor is null)
      or (target_rule_type = 'PER_AMOUNT' and target_program_type = 'STAMPS_PER_AMOUNT'
        and target_amount_per_stamp_minor between 1 and 9007199254740991), false
    ) then
    return 'INVALID';
  end if;

  select tier.* into top_tier
  from jsonb_to_recordset(target_reward_tiers) as tier(
    stamps_required integer, name text, description text, expiration_days integer
  ) order by stamps_required desc limit 1;

  update public.loyalty_programs
  set name = btrim(target_name),
      status = case when card_record.status = 'PUBLISHED'
        then 'ACTIVE'::public.loyalty_program_status
        else 'PAUSED'::public.loyalty_program_status end,
      program_type = target_program_type,
      rule_type = target_rule_type,
      minimum_purchase_minor = target_minimum_purchase_minor,
      stamps_per_purchase = target_stamps_per_purchase,
      amount_per_stamp_minor = target_amount_per_stamp_minor,
      carry_remainder = target_carry_remainder,
      reward_stamp_goal = top_tier.stamps_required,
      reward_name = btrim(top_tier.name),
      reward_description = btrim(top_tier.description),
      reward_expiration_days = top_tier.expiration_days,
      terms_and_conditions = btrim(target_terms_and_conditions),
      unit_name_singular = btrim(target_unit_name_singular),
      unit_name_plural = btrim(target_unit_name_plural),
      version = version + 1,
      updated_at = now()
  where id = card_record.program_id;

  perform app.replace_reward_tiers(card_record.program_id, card_record.tenant_id, target_reward_tiers);
  update public.loyalty_cards
  set name = btrim(target_name), program_completed = true,
      current_step = greatest(current_step, 2), updated_by_staff_id = staff_record.id
  where id = target_card_id;
  return 'SAVED';
exception when check_violation or unique_violation or numeric_value_out_of_range then
  return 'INVALID';
end;
$$;

create function app.save_loyalty_card_design(
  target_card_id uuid,
  target_wallet_enabled boolean,
  target_logo_text text,
  target_description text,
  target_background_color text,
  target_foreground_color text,
  target_label_color text,
  target_logo_image_url text,
  target_strip_image_url text
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  normalized_logo_url text := nullif(btrim(target_logo_image_url), '');
  normalized_strip_url text := nullif(btrim(target_strip_image_url), '');
begin
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid() and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE' and t.status = 'ACTIVE';
  if staff_record.id is null or target_wallet_enabled is null
    or coalesce(length(btrim(target_logo_text)), 0) not between 1 and 60
    or coalesce(length(btrim(target_description)), 0) not between 1 and 120
    or upper(target_background_color) !~ '^#[0-9A-F]{6}$'
    or upper(target_foreground_color) !~ '^#[0-9A-F]{6}$'
    or upper(target_label_color) !~ '^#[0-9A-F]{6}$'
    or (normalized_logo_url is not null and normalized_logo_url !~ '^https://')
    or (normalized_strip_url is not null and normalized_strip_url !~ '^https://') then
    return 'INVALID';
  end if;

  update public.loyalty_cards
  set wallet_enabled = target_wallet_enabled,
      logo_text = btrim(target_logo_text), description = btrim(target_description),
      background_color = upper(target_background_color),
      foreground_color = upper(target_foreground_color),
      label_color = upper(target_label_color),
      logo_image_url = normalized_logo_url, strip_image_url = normalized_strip_url,
      design_completed = true, current_step = greatest(current_step, 3),
      updated_by_staff_id = staff_record.id
  where id = target_card_id and tenant_id = staff_record.tenant_id
    and status <> 'ARCHIVED';
  if not found then return 'UNAVAILABLE'; end if;
  return 'SAVED';
exception when check_violation then return 'INVALID';
end;
$$;

create function app.save_loyalty_card_locations(
  target_card_id uuid,
  target_branch_ids uuid[]
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  card_record record;
begin
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid() and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE' and t.status = 'ACTIVE';
  select card.* into card_record from public.loyalty_cards card
  where card.id = target_card_id and card.tenant_id = staff_record.tenant_id
    and card.status <> 'ARCHIVED' for update;
  if staff_record.id is null or card_record.id is null
    or coalesce(array_length(target_branch_ids, 1), 0) < 1
    or exists (
      select 1 from unnest(target_branch_ids) branch_id
      left join public.branches branch on branch.id = branch_id
      where branch.id is null or branch.tenant_id <> staff_record.tenant_id
        or branch.status <> 'ACTIVE'
    ) then
    return 'INVALID';
  end if;
  delete from public.loyalty_card_branches where loyalty_card_id = target_card_id;
  insert into public.loyalty_card_branches (loyalty_card_id, branch_id, tenant_id)
  select target_card_id, branch_id, staff_record.tenant_id
  from (select distinct unnest(target_branch_ids) as branch_id) selected;
  update public.loyalty_cards
  set locations_completed = true, current_step = 4,
      updated_by_staff_id = staff_record.id
  where id = target_card_id;
  return 'SAVED';
end;
$$;

create function app.publish_loyalty_card(target_card_id uuid)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  card_record record;
begin
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid() and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE' and t.status = 'ACTIVE';
  select card.* into card_record from public.loyalty_cards card
  where card.id = target_card_id and card.tenant_id = staff_record.tenant_id
    and card.status = 'DRAFT' for update;
  if staff_record.id is null or card_record.id is null then return 'UNAVAILABLE'; end if;
  if not card_record.program_completed or not card_record.design_completed
    or not card_record.locations_completed
    or not exists (select 1 from public.loyalty_card_branches where loyalty_card_id = target_card_id) then
    return 'INCOMPLETE';
  end if;
  update public.loyalty_cards
  set status = 'PUBLISHED', published_at = now(), current_step = 4,
      updated_by_staff_id = staff_record.id
  where id = target_card_id;
  update public.loyalty_programs set status = 'ACTIVE', updated_at = now()
  where id = card_record.program_id;
  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    staff_record.tenant_id, staff_record.id, 'LOYALTY_CARD_PUBLISHED',
    'loyalty_cards', target_card_id,
    jsonb_build_object('program_id', card_record.program_id)
  );
  return 'PUBLISHED';
end;
$$;

create function app.get_loyalty_card_stats(target_card_id uuid)
returns table (
  issued_cards bigint,
  purchase_count bigint,
  purchase_amount_minor bigint,
  units_awarded bigint,
  rewards_generated bigint,
  rewards_redeemed bigint
)
language sql
stable
security definer
set search_path = public, app, auth
as $$
  select
    (select count(*) from public.customer_cards issued
      where issued.loyalty_card_id = card.id and issued.status = 'ACTIVE'),
    (select count(*) from public.purchases purchase
      where purchase.loyalty_card_id = card.id and purchase.status = 'CONFIRMED'),
    coalesce((select sum(purchase.amount_minor) from public.purchases purchase
      where purchase.loyalty_card_id = card.id and purchase.status = 'CONFIRMED'), 0),
    coalesce((select sum(purchase.stamps_awarded) from public.purchases purchase
      where purchase.loyalty_card_id = card.id and purchase.status = 'CONFIRMED'), 0),
    (select count(*) from public.rewards reward where reward.loyalty_card_id = card.id),
    (select count(*) from public.rewards reward
      where reward.loyalty_card_id = card.id and reward.status = 'REDEEMED')
  from public.loyalty_cards card
  where card.id = target_card_id
    and (app.is_superadmin() or app.current_staff_can_manage_tenant(card.tenant_id));
$$;

revoke all on function app.enforce_loyalty_card_limit() from public, anon, authenticated;
revoke all on function app.enforce_loyalty_card_tenant_consistency() from public, anon, authenticated;
revoke all on function app.enforce_loyalty_card_branch_tenant_consistency() from public, anon, authenticated;
revoke all on function app.fill_loyalty_card_scope() from public, anon, authenticated;
revoke all on function app.create_loyalty_card_draft(text) from public, anon;
revoke all on function app.save_loyalty_card_program(uuid, text, public.loyalty_program_type, public.loyalty_rule_type, bigint, integer, bigint, boolean, text, jsonb, text, text) from public, anon;
revoke all on function app.save_loyalty_card_design(uuid, boolean, text, text, text, text, text, text, text) from public, anon;
revoke all on function app.save_loyalty_card_locations(uuid, uuid[]) from public, anon;
revoke all on function app.publish_loyalty_card(uuid) from public, anon;
revoke all on function app.get_loyalty_card_stats(uuid) from public, anon;
grant execute on function app.create_loyalty_card_draft(text) to authenticated;
grant execute on function app.save_loyalty_card_program(uuid, text, public.loyalty_program_type, public.loyalty_rule_type, bigint, integer, bigint, boolean, text, jsonb, text, text) to authenticated;
grant execute on function app.save_loyalty_card_design(uuid, boolean, text, text, text, text, text, text, text) to authenticated;
grant execute on function app.save_loyalty_card_locations(uuid, uuid[]) to authenticated;
grant execute on function app.publish_loyalty_card(uuid) to authenticated;
grant execute on function app.get_loyalty_card_stats(uuid) to authenticated;
