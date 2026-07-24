create or replace function app.get_dashboard_branch_metrics(
  from_date timestamptz default null,
  to_date timestamptz default null
)
returns table (
  branch_id uuid,
  branch_name text,
  customer_count bigint,
  purchase_count bigint,
  purchase_amount_minor bigint,
  stamps_awarded bigint
)
language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
declare staff_record record;
begin
  select sp.id, sp.tenant_id, sp.role into staff_record
  from public.staff_profiles sp join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid() and sp.status = 'ACTIVE' and t.status = 'ACTIVE';
  if staff_record.id is null or staff_record.role not in ('ADMIN', 'MANAGER') then return; end if;
  return query
  with allowed as (
    select b.id, b.name from public.branches b
    where b.tenant_id = staff_record.tenant_id and b.status = 'ACTIVE'
      and (staff_record.role = 'ADMIN' or exists (select 1 from public.staff_branch_assignments sba where sba.branch_id = b.id and sba.staff_profile_id = staff_record.id))
  ), customers_by_branch as (
    select c.source_branch_id, count(*) as customer_count
    from public.customers c join allowed a on a.id = c.source_branch_id
    where (from_date is null or c.created_at >= from_date) and (to_date is null or c.created_at < to_date)
    group by c.source_branch_id
  ), purchases_by_branch as (
    select p.branch_id, count(*) as purchase_count, coalesce(sum(p.amount_minor), 0)::bigint as purchase_amount_minor, coalesce(sum(p.stamps_awarded), 0)::bigint as stamps_awarded
    from public.purchases p join allowed a on a.id = p.branch_id
    where p.status = 'CONFIRMED' and (from_date is null or p.created_at >= from_date) and (to_date is null or p.created_at < to_date)
    group by p.branch_id
  )
  select a.id, a.name, coalesce(c.customer_count, 0)::bigint, coalesce(p.purchase_count, 0)::bigint, coalesce(p.purchase_amount_minor, 0)::bigint, coalesce(p.stamps_awarded, 0)::bigint
  from allowed a left join customers_by_branch c on c.source_branch_id = a.id left join purchases_by_branch p on p.branch_id = a.id
  order by a.name;
end;
$$;

revoke all on function app.get_dashboard_branch_metrics(timestamptz, timestamptz) from public, anon;
grant execute on function app.get_dashboard_branch_metrics(timestamptz, timestamptz) to authenticated;
