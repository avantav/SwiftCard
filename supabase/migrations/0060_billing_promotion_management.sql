create function app.create_billing_promotion(
  target_code text,
  target_name text,
  target_description text,
  target_discount_type public.billing_discount_type,
  target_percent_off_basis_points integer,
  target_amount_off_minor bigint,
  target_currency_code text,
  target_duration public.billing_promotion_duration,
  target_duration_months integer,
  target_starts_at timestamptz,
  target_ends_at timestamptz,
  target_max_redemptions integer,
  target_max_redemptions_per_tenant integer,
  target_membership_coverage_limit integer,
  target_package_ids uuid[]
)
returns table (result text, promotion_id uuid)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  actor_id uuid := auth.uid();
  promotion_id_value uuid;
  requested_package_count integer;
begin
  if not app.is_superadmin() then
    return query select 'UNAVAILABLE', null::uuid;
    return;
  end if;

  select count(distinct package_id) into requested_package_count
  from unnest(coalesce(target_package_ids, '{}'::uuid[])) as requested(package_id);

  if requested_package_count = 0
    or array_position(target_package_ids, null) is not null
    or requested_package_count <> (
    select count(*) from public.billing_packages
    where id = any(target_package_ids) and status <> 'ARCHIVED'
  ) then
    return query select 'INVALID_PACKAGES', null::uuid;
    return;
  end if;

  insert into public.billing_promotions (
    code, name, description, discount_type, percent_off_basis_points,
    amount_off_minor, currency_code, duration, duration_months, starts_at,
    ends_at, max_redemptions, max_redemptions_per_tenant,
    membership_coverage_limit, created_by_staff_id, updated_by_staff_id
  ) values (
    upper(btrim(target_code)), btrim(target_name), btrim(target_description),
    target_discount_type, target_percent_off_basis_points,
    target_amount_off_minor, upper(btrim(target_currency_code)), target_duration,
    target_duration_months, target_starts_at, target_ends_at,
    target_max_redemptions, target_max_redemptions_per_tenant,
    target_membership_coverage_limit, actor_id, actor_id
  ) returning id into promotion_id_value;

  insert into public.billing_promotion_packages (promotion_id, package_id)
  select promotion_id_value, package_id
  from unnest(target_package_ids) as requested(package_id)
  group by package_id;

  return query select 'CREATED', promotion_id_value;
exception when check_violation or unique_violation then
  return query select 'INVALID', null::uuid;
end;
$$;

create function app.set_billing_promotion_status(
  target_promotion_id uuid,
  target_status public.billing_catalog_status
)
returns text
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  actor_id uuid := auth.uid();
begin
  if not app.is_superadmin() or target_status = 'DRAFT' then return 'UNAVAILABLE'; end if;

  if target_status = 'ACTIVE' and not exists (
    select 1
    from public.billing_promotions promotion
    join public.billing_promotion_packages eligibility on eligibility.promotion_id = promotion.id
    join public.billing_packages package on package.id = eligibility.package_id
    where promotion.id = target_promotion_id
      and package.status = 'ACTIVE'
      and (promotion.ends_at is null or promotion.ends_at > now())
  ) then
    return 'INVALID';
  end if;

  update public.billing_promotions
  set status = target_status, updated_by_staff_id = actor_id
  where id = target_promotion_id and status <> target_status;

  if not found then
    return case when exists (
      select 1 from public.billing_promotions where id = target_promotion_id and status = target_status
    ) then 'UNCHANGED' else 'UNAVAILABLE' end;
  end if;
  return case when target_status = 'ACTIVE' then 'ACTIVATED' else 'ARCHIVED' end;
end;
$$;

revoke all on function app.create_billing_promotion(text, text, text, public.billing_discount_type, integer, bigint, text, public.billing_promotion_duration, integer, timestamptz, timestamptz, integer, integer, integer, uuid[]) from public, anon;
revoke all on function app.set_billing_promotion_status(uuid, public.billing_catalog_status) from public, anon;
grant execute on function app.create_billing_promotion(text, text, text, public.billing_discount_type, integer, bigint, text, public.billing_promotion_duration, integer, timestamptz, timestamptz, integer, integer, integer, uuid[]) to authenticated;
grant execute on function app.set_billing_promotion_status(uuid, public.billing_catalog_status) to authenticated;

revoke insert, update on public.billing_promotions, public.billing_promotion_packages from authenticated;
