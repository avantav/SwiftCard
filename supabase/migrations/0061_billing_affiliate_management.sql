alter table public.billing_affiliates
  add constraint billing_affiliates_email_format check (
    contact_email is null or contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

create function app.create_billing_affiliate(
  target_code text,
  target_display_name text,
  target_contact_email text,
  target_commission_type public.affiliate_commission_type,
  target_commission_basis_points integer,
  target_commission_amount_minor bigint,
  target_currency_code text,
  target_attribution_window_days integer
)
returns table (result text, affiliate_id uuid)
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
declare
  actor_id uuid := auth.uid();
  affiliate_id_value uuid;
begin
  if not app.is_superadmin() then
    return query select 'UNAVAILABLE', null::uuid;
    return;
  end if;

  insert into public.billing_affiliates (
    code, display_name, contact_email, commission_type,
    commission_basis_points, commission_amount_minor, currency_code,
    attribution_window_days, created_by_staff_id, updated_by_staff_id
  ) values (
    upper(btrim(target_code)), btrim(target_display_name),
    nullif(lower(btrim(target_contact_email)), ''), target_commission_type,
    target_commission_basis_points, target_commission_amount_minor,
    upper(btrim(target_currency_code)), target_attribution_window_days,
    actor_id, actor_id
  ) returning id into affiliate_id_value;

  return query select 'CREATED', affiliate_id_value;
exception when check_violation or unique_violation or not_null_violation then
  return query select 'INVALID', null::uuid;
end;
$$;

create function app.set_billing_affiliate_status(
  target_affiliate_id uuid,
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

  update public.billing_affiliates
  set status = target_status, updated_by_staff_id = actor_id
  where id = target_affiliate_id and status <> target_status;

  if not found then
    return case when exists (
      select 1 from public.billing_affiliates where id = target_affiliate_id and status = target_status
    ) then 'UNCHANGED' else 'UNAVAILABLE' end;
  end if;
  return case when target_status = 'ACTIVE' then 'ACTIVATED' else 'ARCHIVED' end;
end;
$$;

revoke all on function app.create_billing_affiliate(text, text, text, public.affiliate_commission_type, integer, bigint, text, integer) from public, anon;
revoke all on function app.set_billing_affiliate_status(uuid, public.billing_catalog_status) from public, anon;
grant execute on function app.create_billing_affiliate(text, text, text, public.affiliate_commission_type, integer, bigint, text, integer) to authenticated;
grant execute on function app.set_billing_affiliate_status(uuid, public.billing_catalog_status) to authenticated;

revoke insert, update on public.billing_affiliates from authenticated;
