create or replace function app.get_dashboard_metrics(
  target_branch_id uuid default null,
  from_date timestamptz default null,
  to_date timestamptz default null
)
returns table (
  customer_count bigint,
  new_customer_count bigint,
  purchase_count bigint,
  purchase_amount_minor bigint,
  stamps_awarded bigint,
  rewards_generated bigint,
  rewards_redeemed bigint
)
language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
declare staff_record record; branch_allowed boolean;
begin
  select sp.id, sp.tenant_id, sp.role into staff_record
  from public.staff_profiles sp join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid() and sp.status = 'ACTIVE' and t.status = 'ACTIVE';
  if staff_record.id is null or staff_record.role not in ('ADMIN', 'MANAGER') then
    return query select 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint;
    return;
  end if;
  if target_branch_id is not null then
    branch_allowed := exists (
      select 1 from public.branches b
      where b.id = target_branch_id and b.tenant_id = staff_record.tenant_id and b.status = 'ACTIVE'
        and (staff_record.role = 'ADMIN' or exists (select 1 from public.staff_branch_assignments sba where sba.branch_id = b.id and sba.staff_profile_id = staff_record.id))
    );
    if not branch_allowed then
      return query select 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint;
      return;
    end if;
  end if;
  return query
  with accessible_branches as (
    select b.id from public.branches b where b.tenant_id = staff_record.tenant_id and b.status = 'ACTIVE'
      and (target_branch_id is null or b.id = target_branch_id)
      and (staff_record.role = 'ADMIN' or exists (select 1 from public.staff_branch_assignments sba where sba.branch_id = b.id and sba.staff_profile_id = staff_record.id))
  ), scoped_customers as (
    select c.* from public.customers c join accessible_branches ab on ab.id = c.source_branch_id
    where (from_date is null or c.created_at >= from_date) and (to_date is null or c.created_at < to_date)
  ), scoped_purchases as (
    select p.* from public.purchases p join accessible_branches ab on ab.id = p.branch_id
    where p.status = 'CONFIRMED' and (from_date is null or p.created_at >= from_date) and (to_date is null or p.created_at < to_date)
  )
  select
    (select count(*) from scoped_customers),
    (select count(*) from scoped_customers where registration_method is not null),
    (select count(*) from scoped_purchases),
    coalesce((select sum(sp.amount_minor) from scoped_purchases sp), 0::bigint)::bigint,
    coalesce((select sum(sp.stamps_awarded) from scoped_purchases sp), 0::bigint)::bigint,
    (select count(*) from public.rewards r where r.tenant_id = staff_record.tenant_id and r.source_purchase_id in (select id from scoped_purchases)),
    (select count(*) from public.reward_redemptions rr join accessible_branches ab on ab.id = rr.branch_id where rr.status = 'COMPLETED' and (from_date is null or rr.redeemed_at >= from_date) and (to_date is null or rr.redeemed_at < to_date));
end;
$$;

revoke all on function app.get_dashboard_metrics(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function app.get_dashboard_metrics(uuid, timestamptz, timestamptz) to authenticated;
