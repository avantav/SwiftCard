-- Give active staff a read-only projection of the published loyalty programs
-- available in their assigned branches. The function derives tenant and branch
-- scope from the authenticated session and never accepts tenant identifiers.

create function app.get_staff_program_catalog()
returns table (
  loyalty_card_id uuid,
  card_name text,
  program_name text,
  program_status text,
  program_type text,
  minimum_purchase_minor bigint,
  stamps_per_purchase integer,
  amount_per_stamp_minor bigint,
  carry_remainder boolean,
  unit_name_singular text,
  unit_name_plural text,
  currency_code text,
  terms_and_conditions text,
  reward_tiers jsonb
)
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select
    card.id,
    card.name,
    program.name,
    program.status::text,
    program.program_type::text,
    program.minimum_purchase_minor,
    program.stamps_per_purchase,
    program.amount_per_stamp_minor,
    program.carry_remainder,
    program.unit_name_singular,
    program.unit_name_plural,
    tenant.currency_code::text,
    program.terms_and_conditions,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'stamps_required', tier.stamps_required,
          'name', tier.name,
          'description', tier.description,
          'expiration_days', tier.expiration_days
        )
        order by tier.stamps_required, tier.id
      )
      from public.loyalty_reward_tiers tier
      where tier.program_id = program.id
        and tier.active
    ), '[]'::jsonb)
  from public.staff_profiles staff
  join public.tenants tenant
    on tenant.id = staff.tenant_id
    and tenant.status = 'ACTIVE'
  join public.loyalty_cards card
    on card.tenant_id = staff.tenant_id
    and card.status = 'PUBLISHED'
  join public.loyalty_programs program
    on program.id = card.program_id
  where staff.id = auth.uid()
    and staff.status = 'ACTIVE'
    and exists (
      select 1
      from public.loyalty_card_branches assignment
      join public.branches branch
        on branch.id = assignment.branch_id
        and branch.status = 'ACTIVE'
      where assignment.loyalty_card_id = card.id
        and app.current_staff_can_access_branch(branch.id)
    )
  order by card.name, card.id;
$$;

revoke all on function app.get_staff_program_catalog() from public, anon, authenticated;
grant execute on function app.get_staff_program_catalog() to authenticated;

-- Return the operational customer snapshot used after a QR scan or manual
-- search. The caller supplies only an opaque issued-card id; tenant authority
-- and active operator access are still derived from the authenticated session.
create function app.get_staff_customer_card_summary(target_customer_card_id uuid)
returns table (
  customer_id uuid,
  customer_name text,
  customer_phone text,
  customer_card_id uuid,
  loyalty_card_id uuid,
  card_name text,
  program_name text,
  program_status text,
  stamp_balance integer,
  unit_name_singular text,
  unit_name_plural text,
  available_rewards jsonb
)
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select
    customer.id,
    customer.full_name,
    customer.normalized_phone,
    issued.id,
    card.id,
    card.name,
    program.name,
    program.status::text,
    coalesce(balance.stamp_balance, 0),
    program.unit_name_singular,
    program.unit_name_plural,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', reward.id,
          'name', reward.name,
          'description', reward.description,
          'expires_at', reward.expires_at
        )
        order by reward.expires_at nulls last, reward.created_at, reward.id
      )
      from public.rewards reward
      where reward.customer_id = customer.id
        and reward.loyalty_card_id = card.id
        and reward.status = 'AVAILABLE'
        and (reward.expires_at is null or reward.expires_at > now())
    ), '[]'::jsonb)
  from public.staff_profiles staff
  join public.tenants tenant
    on tenant.id = staff.tenant_id
    and tenant.status = 'ACTIVE'
  join public.customer_cards issued
    on issued.id = target_customer_card_id
    and issued.tenant_id = staff.tenant_id
    and issued.status = 'ACTIVE'
  join public.customers customer
    on customer.id = issued.customer_id
    and customer.status = 'ACTIVE'
  join public.loyalty_cards card
    on card.id = issued.loyalty_card_id
    and card.status = 'PUBLISHED'
  join public.loyalty_programs program
    on program.id = card.program_id
  left join public.customer_loyalty_balances balance
    on balance.customer_id = customer.id
  where staff.id = auth.uid()
    and staff.status = 'ACTIVE'
    and (
      (
        staff.account_kind = 'INDIVIDUAL'
        and (
          staff.role = 'MANAGER'
          or exists (
            select 1
            from public.staff_branch_assignments assignment
            where assignment.staff_profile_id = staff.id
              and app.current_staff_can_access_branch(assignment.branch_id)
          )
        )
      )
      or app.current_pin_operator_id() is not null
    );
$$;

revoke all on function app.get_staff_customer_card_summary(uuid) from public, anon, authenticated;
grant execute on function app.get_staff_customer_card_summary(uuid) to authenticated;
