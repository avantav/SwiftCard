-- Consolidate accidental duplicate drafts and add tenant-Admin-only lifecycle
-- operations for card configurations and customer records. Archival preserves
-- history; physical deletion is allowed only when no operational history exists.

create temporary table duplicate_loyalty_card_drafts (
  card_id uuid primary key,
  program_id uuid not null,
  survivor_id uuid not null
);

insert into duplicate_loyalty_card_drafts (card_id, program_id, survivor_id)
select ranked.id, ranked.program_id, ranked.survivor_id
from (
  select card.id, card.program_id,
    first_value(card.id) over (
      partition by card.tenant_id, lower(btrim(card.name))
      order by
        card.current_step desc,
        (
          card.program_completed::integer
          + card.design_completed::integer
          + card.locations_completed::integer
        ) desc,
        card.updated_at desc,
        card.id
    ) as survivor_id,
    row_number() over (
      partition by card.tenant_id, lower(btrim(card.name))
      order by
        card.current_step desc,
        (
          card.program_completed::integer
          + card.design_completed::integer
          + card.locations_completed::integer
        ) desc,
        card.updated_at desc,
        card.id
    ) as draft_rank
  from public.loyalty_cards card
  where card.status = 'DRAFT'
) ranked
where ranked.draft_rank > 1;

insert into public.audit_logs (
  tenant_id, action, entity_type, entity_id, metadata
)
select
  card.tenant_id,
  'LOYALTY_CARD_DUPLICATE_DRAFT_REMOVED',
  'loyalty_cards',
  duplicate.card_id,
  jsonb_build_object('consolidated_into', duplicate.survivor_id)
from duplicate_loyalty_card_drafts duplicate
join public.loyalty_cards card on card.id = duplicate.card_id;

delete from public.loyalty_reward_tiers tier
using duplicate_loyalty_card_drafts duplicate
where tier.program_id = duplicate.program_id;

delete from public.loyalty_cards card
using duplicate_loyalty_card_drafts duplicate
where card.id = duplicate.card_id;

delete from public.loyalty_programs program
using duplicate_loyalty_card_drafts duplicate
where program.id = duplicate.program_id;

create unique index loyalty_cards_tenant_draft_name_unique_idx
  on public.loyalty_cards (tenant_id, lower(btrim(name)))
  where status = 'DRAFT';

create or replace function app.create_loyalty_card_draft(target_name text)
returns table (result text, loyalty_card_id uuid)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
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

  select card.id into card_id_value
  from public.loyalty_cards card
  where card.tenant_id = staff_record.tenant_id
    and card.status = 'DRAFT'
    and lower(btrim(card.name)) = lower(normalized_name)
  order by card.current_step desc, card.updated_at desc, card.id
  limit 1;

  if card_id_value is not null then
    return query select 'EXISTS', card_id_value;
    return;
  end if;

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

create function app.archive_loyalty_card(target_card_id uuid)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  card_record record;
  result_value text;
begin
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp
  join public.tenants tenant on tenant.id = sp.tenant_id
  where sp.id = auth.uid() and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE' and tenant.status = 'ACTIVE';

  select card.* into card_record
  from public.loyalty_cards card
  where card.id = target_card_id
    and card.tenant_id = staff_record.tenant_id
    and card.status <> 'ARCHIVED'
  for update;

  if staff_record.id is null or card_record.id is null then
    return 'UNAVAILABLE';
  end if;

  result_value := case when card_record.status = 'DRAFT'
    then 'DISCARDED' else 'DEACTIVATED' end;

  update public.loyalty_cards
  set status = 'ARCHIVED', updated_by_staff_id = staff_record.id
  where id = card_record.id;
  update public.loyalty_programs
  set status = 'PAUSED', updated_at = now()
  where id = card_record.program_id;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    staff_record.tenant_id,
    staff_record.id,
    case when result_value = 'DISCARDED'
      then 'LOYALTY_CARD_DRAFT_DISCARDED' else 'LOYALTY_CARD_DEACTIVATED' end,
    'loyalty_cards',
    card_record.id,
    jsonb_build_object('previous_status', card_record.status::text)
  );

  return result_value;
end;
$$;

create function app.restore_loyalty_card(target_card_id uuid)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  card_record record;
  restored_status public.loyalty_card_status;
begin
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp
  join public.tenants tenant on tenant.id = sp.tenant_id
  where sp.id = auth.uid() and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE' and tenant.status = 'ACTIVE';

  select card.* into card_record
  from public.loyalty_cards card
  where card.id = target_card_id
    and card.tenant_id = staff_record.tenant_id
    and card.status = 'ARCHIVED'
  for update;

  if staff_record.id is null or card_record.id is null then
    return 'UNAVAILABLE';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('swiftwallet:tenant-cards:' || staff_record.tenant_id::text, 0)
  );
  if (select count(*) from public.loyalty_cards
      where tenant_id = staff_record.tenant_id and status <> 'ARCHIVED') >= 3 then
    return 'LIMIT_REACHED';
  end if;

  restored_status := case when card_record.published_at is null
    then 'DRAFT'::public.loyalty_card_status
    else 'PUBLISHED'::public.loyalty_card_status end;

  if restored_status = 'DRAFT' and exists (
    select 1 from public.loyalty_cards card
    where card.tenant_id = staff_record.tenant_id
      and card.status = 'DRAFT'
      and lower(btrim(card.name)) = lower(btrim(card_record.name))
  ) then
    return 'DUPLICATE';
  end if;

  update public.loyalty_cards
  set status = restored_status, updated_by_staff_id = staff_record.id
  where id = card_record.id;
  update public.loyalty_programs
  set status = case when restored_status = 'PUBLISHED'
      then 'ACTIVE'::public.loyalty_program_status
      else 'PAUSED'::public.loyalty_program_status end,
      updated_at = now()
  where id = card_record.program_id;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    staff_record.tenant_id, staff_record.id, 'LOYALTY_CARD_RESTORED',
    'loyalty_cards', card_record.id,
    jsonb_build_object('restored_status', restored_status::text)
  );

  return 'RESTORED';
exception when check_violation or unique_violation then
  return 'LIMIT_REACHED';
end;
$$;

create function app.delete_archived_loyalty_card(target_card_id uuid)
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
  from public.staff_profiles sp
  join public.tenants tenant on tenant.id = sp.tenant_id
  where sp.id = auth.uid() and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE' and tenant.status = 'ACTIVE';

  select card.* into card_record
  from public.loyalty_cards card
  where card.id = target_card_id
    and card.tenant_id = staff_record.tenant_id
    and card.status = 'ARCHIVED'
  for update;

  if staff_record.id is null or card_record.id is null then
    return 'UNAVAILABLE';
  end if;

  if exists (select 1 from public.customer_cards where loyalty_card_id = card_record.id)
    or exists (select 1 from public.purchases where loyalty_card_id = card_record.id)
    or exists (select 1 from public.stamp_ledger where loyalty_card_id = card_record.id)
    or exists (select 1 from public.stamp_adjustments where loyalty_card_id = card_record.id)
    or exists (select 1 from public.rewards where loyalty_card_id = card_record.id)
    or exists (select 1 from public.customer_card_terms_acceptances where loyalty_card_id = card_record.id) then
    return 'HAS_HISTORY';
  end if;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    staff_record.tenant_id, staff_record.id, 'LOYALTY_CARD_DELETED',
    'loyalty_cards', card_record.id,
    jsonb_build_object('program_id', card_record.program_id)
  );

  delete from public.loyalty_reward_tiers where program_id = card_record.program_id;
  delete from public.loyalty_cards where id = card_record.id;
  delete from public.loyalty_programs where id = card_record.program_id;
  return 'DELETED';
end;
$$;

create function app.set_admin_customer_status(
  target_customer_id uuid,
  target_status public.customer_status
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  customer_record record;
begin
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp
  join public.tenants tenant on tenant.id = sp.tenant_id
  where sp.id = auth.uid() and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE' and tenant.status = 'ACTIVE';

  select customer.id, customer.tenant_id into customer_record
  from public.customers customer
  where customer.id = target_customer_id
    and customer.tenant_id = staff_record.tenant_id
  for update;

  if staff_record.id is null or customer_record.id is null or target_status is null then
    return 'UNAVAILABLE';
  end if;

  update public.customers set status = target_status
  where id = customer_record.id;
  return 'UPDATED';
end;
$$;

create function app.delete_admin_customer(target_customer_id uuid)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  customer_record record;
begin
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp
  join public.tenants tenant on tenant.id = sp.tenant_id
  where sp.id = auth.uid() and sp.role = 'ADMIN'
    and sp.status = 'ACTIVE' and tenant.status = 'ACTIVE';

  select customer.* into customer_record
  from public.customers customer
  where customer.id = target_customer_id
    and customer.tenant_id = staff_record.tenant_id
  for update;

  if staff_record.id is null or customer_record.id is null then
    return 'UNAVAILABLE';
  end if;

  if exists (select 1 from public.purchases where customer_id = customer_record.id)
    or exists (select 1 from public.stamp_ledger where customer_id = customer_record.id)
    or exists (select 1 from public.rewards where customer_id = customer_record.id)
    or exists (select 1 from public.reward_redemptions where customer_id = customer_record.id)
    or exists (select 1 from public.stamp_adjustments where customer_id = customer_record.id)
    or exists (select 1 from public.wallet_passes where customer_id = customer_record.id)
    or exists (
      select 1 from public.customer_loyalty_balances balance
      where balance.customer_id = customer_record.id
        and (balance.stamp_balance <> 0
          or balance.remainder_minor <> 0
          or balance.completed_cycles <> 0
          or balance.lifetime_points_tenths <> 0)
    ) then
    return 'HAS_HISTORY';
  end if;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    staff_record.tenant_id, staff_record.id, 'CUSTOMER_DELETED',
    'customers', customer_record.id,
    jsonb_build_object(
      'previous_status', customer_record.status::text,
      'registration_method', customer_record.registration_method::text
    )
  );

  delete from public.customer_card_terms_acceptances acceptance
  using public.customer_cards issued
  where acceptance.customer_card_id = issued.id
    and issued.customer_id = customer_record.id;
  delete from public.customers where id = customer_record.id;
  return 'DELETED';
end;
$$;

revoke all on function app.create_loyalty_card_draft(text) from public, anon, authenticated;
revoke all on function app.archive_loyalty_card(uuid) from public, anon, authenticated;
revoke all on function app.restore_loyalty_card(uuid) from public, anon, authenticated;
revoke all on function app.delete_archived_loyalty_card(uuid) from public, anon, authenticated;
revoke all on function app.set_admin_customer_status(uuid, public.customer_status) from public, anon, authenticated;
revoke all on function app.delete_admin_customer(uuid) from public, anon, authenticated;

grant execute on function app.create_loyalty_card_draft(text) to authenticated;
grant execute on function app.archive_loyalty_card(uuid) to authenticated;
grant execute on function app.restore_loyalty_card(uuid) to authenticated;
grant execute on function app.delete_archived_loyalty_card(uuid) to authenticated;
grant execute on function app.set_admin_customer_status(uuid, public.customer_status) to authenticated;
grant execute on function app.delete_admin_customer(uuid) to authenticated;
