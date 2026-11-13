-- Statistics dashboard focused on retention (DEC-0067).
-- One shared segmentation rule (customer_segment_snapshot) feeds the dashboard
-- and, later, Empresarial campaigns. Scope mirrors app.get_dashboard_metrics:
-- tenant Admins see every active branch, Managers only assigned branches.
-- Calendar periods use the tenant time zone. Only confirmed purchases count.
--
-- Segments (exactly one per active customer, evaluated in this order, as of
-- the end of the period):
--   NEW              registered in the last 30 days
--   NEVER_PURCHASED  no purchases
--   LOST             last purchase more than 60 days ago
--   AT_RISK          2+ purchases, last one 31-60 days ago
--   FREQUENT         4+ purchases, last one within 30 days
--   OCCASIONAL       2-3 purchases, last one within 30 days
--   ONE_VISIT        a single purchase within the last 60 days

create or replace function app.insight_staff()
returns table (staff_id uuid, tenant_id uuid, role public.staff_role, timezone text)
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select sp.id, sp.tenant_id, sp.role, t.timezone
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
    and sp.status = 'ACTIVE'
    and sp.role in ('ADMIN', 'MANAGER')
    and t.status = 'ACTIVE';
$$;

create or replace function app.insight_branches(
  target_staff_id uuid,
  target_tenant_id uuid,
  target_role public.staff_role,
  target_branch_id uuid
)
returns table (branch_id uuid, branch_name text)
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select b.id, b.name
  from public.branches b
  where b.tenant_id = target_tenant_id
    and b.status = 'ACTIVE'
    and (target_branch_id is null or b.id = target_branch_id)
    and (
      target_role = 'ADMIN'
      or exists (
        select 1 from public.staff_branch_assignments sba
        where sba.branch_id = b.id and sba.staff_profile_id = target_staff_id
      )
    );
$$;

create or replace function app.customer_segment_snapshot(
  target_staff_id uuid,
  target_tenant_id uuid,
  target_role public.staff_role,
  target_branch_id uuid,
  target_as_of timestamptz
)
returns table (
  customer_id uuid,
  segment text,
  purchase_count bigint,
  last_purchase_at timestamptz,
  spend_minor bigint,
  registered_at timestamptz
)
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  with scope as (
    select branch_id from app.insight_branches(target_staff_id, target_tenant_id, target_role, target_branch_id)
  ), stats as (
    select p.customer_id,
           count(*) as purchase_count,
           max(p.occurred_at) as last_purchase_at,
           sum(p.amount_minor)::bigint as spend_minor
    from public.purchases p
    join scope on scope.branch_id = p.branch_id
    where p.tenant_id = target_tenant_id
      and p.status = 'CONFIRMED'
      and p.occurred_at < target_as_of
    group by p.customer_id
  ), customers_in_scope as (
    select c.id, c.created_at
    from public.customers c
    where c.tenant_id = target_tenant_id
      and c.status = 'ACTIVE'
      and c.created_at < target_as_of
      and (
        c.source_branch_id in (select branch_id from scope)
        or c.id in (select stats.customer_id from stats)
      )
  )
  select
    c.id,
    case
      when c.created_at >= target_as_of - interval '30 days' then 'NEW'
      when coalesce(s.purchase_count, 0) = 0 then 'NEVER_PURCHASED'
      when s.last_purchase_at < target_as_of - interval '60 days' then 'LOST'
      when s.purchase_count >= 2 and s.last_purchase_at < target_as_of - interval '30 days' then 'AT_RISK'
      when s.purchase_count >= 4 then 'FREQUENT'
      when s.purchase_count >= 2 then 'OCCASIONAL'
      else 'ONE_VISIT'
    end,
    coalesce(s.purchase_count, 0),
    s.last_purchase_at,
    coalesce(s.spend_minor, 0),
    c.created_at
  from customers_in_scope c
  left join stats s on s.customer_id = c.id;
$$;

create or replace function app.get_customer_insights(
  target_from date,
  target_to date,
  target_branch_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff record;
  period_start timestamptz;
  period_end timestamptz;
  previous_start timestamptz;
  span_days integer;
  result jsonb;
begin
  select * into staff from app.insight_staff();
  if staff.staff_id is null then
    raise exception 'insights are restricted to administrators' using errcode = '42501';
  end if;
  if target_from is null or target_to is null or target_to < target_from
    or target_to - target_from > 365 then
    raise exception 'invalid insights period' using errcode = '22023';
  end if;
  if target_branch_id is not null and not exists (
    select 1 from app.insight_branches(staff.staff_id, staff.tenant_id, staff.role, target_branch_id)
  ) then
    raise exception 'branch not available' using errcode = '42501';
  end if;

  span_days := target_to - target_from + 1;
  period_start := target_from::timestamp at time zone staff.timezone;
  period_end := (target_to + 1)::timestamp at time zone staff.timezone;
  previous_start := (target_from - span_days)::timestamp at time zone staff.timezone;

  with scope as (
    select * from app.insight_branches(staff.staff_id, staff.tenant_id, staff.role, target_branch_id)
  ), purchases_scoped as (
    select p.id, p.customer_id, p.branch_id, p.occurred_at, p.amount_minor,
           row_number() over (partition by p.customer_id order by p.occurred_at, p.id) as customer_visit_number
    from public.purchases p
    join scope on scope.branch_id = p.branch_id
    where p.tenant_id = staff.tenant_id
      and p.status = 'CONFIRMED'
      and p.occurred_at < period_end
  ), period_stats as (
    select
      window_name,
      count(*) as purchases,
      coalesce(sum(amount_minor), 0)::bigint as revenue_minor,
      count(distinct customer_id) as active_customers,
      count(distinct customer_id) filter (where lifetime_count >= 2) as returning_customers
    from (
      select 'current' as window_name, ps.*, (
        select count(*) from purchases_scoped x where x.customer_id = ps.customer_id
      ) as lifetime_count
      from purchases_scoped ps
      where ps.occurred_at >= period_start
      union all
      select 'previous', ps.*, (
        select count(*) from purchases_scoped x where x.customer_id = ps.customer_id and x.occurred_at < period_start
      )
      from purchases_scoped ps
      where ps.occurred_at >= previous_start and ps.occurred_at < period_start
    ) w
    group by window_name
  ), registrations as (
    select
      count(*) filter (where c.created_at >= period_start and c.created_at < period_end) as current_new,
      count(*) filter (where c.created_at >= previous_start and c.created_at < period_start) as previous_new
    from public.customers c
    where c.tenant_id = staff.tenant_id
      and c.source_branch_id in (select branch_id from scope)
  ), snapshot as (
    select * from app.customer_segment_snapshot(staff.staff_id, staff.tenant_id, staff.role, target_branch_id, period_end)
  ), weeks as (
    select generate_series(
      date_trunc('week', (period_end - interval '1 second') at time zone staff.timezone) - interval '11 weeks',
      date_trunc('week', (period_end - interval '1 second') at time zone staff.timezone),
      interval '1 week'
    ) as week_start
  )
  select jsonb_build_object(
    'role', staff.role::text,
    'timezone', staff.timezone,
    'period', jsonb_build_object('from', target_from, 'to', target_to, 'days', span_days),
    'summary', (
      select jsonb_build_object(
        'active_customers', coalesce(max(active_customers) filter (where window_name = 'current'), 0),
        'returning_customers', coalesce(max(returning_customers) filter (where window_name = 'current'), 0),
        'purchases', coalesce(max(purchases) filter (where window_name = 'current'), 0),
        'revenue_minor', coalesce(max(revenue_minor) filter (where window_name = 'current'), 0),
        'new_customers', (select current_new from registrations)
      ) from period_stats
    ),
    'previous', (
      select jsonb_build_object(
        'active_customers', coalesce(max(active_customers) filter (where window_name = 'previous'), 0),
        'returning_customers', coalesce(max(returning_customers) filter (where window_name = 'previous'), 0),
        'purchases', coalesce(max(purchases) filter (where window_name = 'previous'), 0),
        'revenue_minor', coalesce(max(revenue_minor) filter (where window_name = 'previous'), 0),
        'new_customers', (select previous_new from registrations)
      ) from period_stats
    ),
    'segments', (
      select jsonb_agg(jsonb_build_object(
        'segment', names.segment,
        'customers', coalesce(counts.customers, 0),
        'spend_minor', coalesce(counts.spend_minor, 0)
      ) order by names.position)
      from (values ('NEW', 1), ('FREQUENT', 2), ('OCCASIONAL', 3), ('ONE_VISIT', 4),
                   ('AT_RISK', 5), ('LOST', 6), ('NEVER_PURCHASED', 7)) as names(segment, position)
      left join (
        select segment, count(*) as customers, sum(spend_minor)::bigint as spend_minor
        from snapshot group by segment
      ) counts on counts.segment = names.segment
    ),
    'funnel', (
      select jsonb_build_object(
        'registered', count(*),
        'purchased_1', count(*) filter (where purchase_count >= 1),
        'purchased_2', count(*) filter (where purchase_count >= 2),
        'purchased_3', count(*) filter (where purchase_count >= 3)
      ) from snapshot
    ),
    'weekly', (
      select jsonb_agg(jsonb_build_object(
        'week_start', to_char(w.week_start, 'YYYY-MM-DD'),
        'new_visits', coalesce(v.new_visits, 0),
        'returning_visits', coalesce(v.returning_visits, 0)
      ) order by w.week_start)
      from weeks w
      left join (
        select date_trunc('week', ps.occurred_at at time zone staff.timezone) as week_start,
               count(*) filter (where ps.customer_visit_number = 1) as new_visits,
               count(*) filter (where ps.customer_visit_number > 1) as returning_visits
        from purchases_scoped ps
        group by 1
      ) v on v.week_start = w.week_start
    ),
    'heatmap', (
      select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'visits', visits)), '[]'::jsonb)
      from (
        select extract(isodow from ps.occurred_at at time zone staff.timezone)::integer as dow,
               extract(hour from ps.occurred_at at time zone staff.timezone)::integer as hour,
               count(*) as visits
        from purchases_scoped ps
        where ps.occurred_at >= period_start
        group by 1, 2
      ) h
    ),
    'rewards', jsonb_build_object(
      'generated', (
        select count(*) from public.rewards r
        join public.customers c on c.id = r.customer_id
        where r.tenant_id = staff.tenant_id
          and r.created_at >= period_start and r.created_at < period_end
          and c.id in (select customer_id from snapshot)
      ),
      'redeemed', (
        select count(*) from public.reward_redemptions rr
        join scope on scope.branch_id = rr.branch_id
        where rr.tenant_id = staff.tenant_id and rr.status = 'COMPLETED'
          and rr.redeemed_at >= period_start and rr.redeemed_at < period_end
      ),
      'pending', (
        select count(*) from public.rewards r
        where r.tenant_id = staff.tenant_id and r.status = 'AVAILABLE'
          and r.customer_id in (select customer_id from snapshot)
      )
    ),
    'top_customers', case when staff.role = 'ADMIN' then (
      select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      from (
        select c.id as customer_id, c.full_name, count(*) as visits, sum(ps.amount_minor)::bigint as spend_minor
        from purchases_scoped ps
        join public.customers c on c.id = ps.customer_id
        where ps.occurred_at >= period_start
        group by c.id, c.full_name
        order by count(*) desc, sum(ps.amount_minor) desc
        limit 10
      ) t
    ) else '[]'::jsonb end,
    'branches', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'branch_id', scope.branch_id,
        'branch_name', scope.branch_name,
        'active_customers', coalesce(b.active_customers, 0),
        'returning_customers', coalesce(b.returning_customers, 0),
        'purchases', coalesce(b.purchases, 0),
        'revenue_minor', coalesce(b.revenue_minor, 0)
      ) order by scope.branch_name), '[]'::jsonb)
      from scope
      left join (
        select ps.branch_id,
               count(*) as purchases,
               sum(ps.amount_minor)::bigint as revenue_minor,
               count(distinct ps.customer_id) as active_customers,
               count(distinct ps.customer_id) filter (where (
                 select count(*) from purchases_scoped x where x.customer_id = ps.customer_id
               ) >= 2) as returning_customers
        from purchases_scoped ps
        where ps.occurred_at >= period_start
        group by ps.branch_id
      ) b on b.branch_id = scope.branch_id
    )
  ) into result;

  return result;
end;
$$;

-- Customers of one segment, for the Admin general only (Managers have no
-- customer directory). Basis for future Empresarial campaigns.
create or replace function app.get_customer_segment_members(
  target_segment text,
  target_branch_id uuid default null
)
returns table (
  customer_id uuid,
  full_name text,
  normalized_phone text,
  email text,
  purchase_count bigint,
  last_purchase_at timestamptz,
  spend_minor bigint,
  registered_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff record;
begin
  select * into staff from app.insight_staff();
  if staff.staff_id is null or staff.role <> 'ADMIN' then
    raise exception 'segment lists are restricted to the general administrator' using errcode = '42501';
  end if;
  if target_segment not in ('NEW', 'FREQUENT', 'OCCASIONAL', 'ONE_VISIT', 'AT_RISK', 'LOST', 'NEVER_PURCHASED') then
    raise exception 'invalid segment' using errcode = '22023';
  end if;

  return query
  select c.id, c.full_name, c.normalized_phone, c.email,
         s.purchase_count, s.last_purchase_at, s.spend_minor, s.registered_at
  from app.customer_segment_snapshot(staff.staff_id, staff.tenant_id, staff.role, target_branch_id, now()) s
  join public.customers c on c.id = s.customer_id
  where s.segment = target_segment
  order by s.spend_minor desc, s.last_purchase_at desc nulls last
  limit 500;
end;
$$;

revoke all on function app.insight_staff() from public, anon, authenticated;
revoke all on function app.insight_branches(uuid, uuid, public.staff_role, uuid) from public, anon, authenticated;
revoke all on function app.customer_segment_snapshot(uuid, uuid, public.staff_role, uuid, timestamptz) from public, anon, authenticated;
revoke all on function app.get_customer_insights(date, date, uuid) from public, anon;
revoke all on function app.get_customer_segment_members(text, uuid) from public, anon;
grant execute on function app.get_customer_insights(date, date, uuid) to authenticated;
grant execute on function app.get_customer_segment_members(text, uuid) to authenticated;
