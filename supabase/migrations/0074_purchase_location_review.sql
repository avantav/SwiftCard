-- Security view: where purchases were recorded (DEC-0066).
-- Observation only: it never changes purchases, geofence enforcement or the
-- coordinates stored by the purchase transaction.
--   * Tenant Admins review every branch of their tenant; Managers only their
--     assigned branches; Employees, shared accounts and Superadmin get nothing.
--   * No customer data is returned.
--   * Every call is written to audit_logs with its filters and row count.

create or replace function app.get_purchase_location_review(
  target_from date,
  target_to date,
  target_branch_id uuid default null,
  target_operator_key text default null,
  target_result text default null
)
returns table (
  purchase_id uuid,
  occurred_at timestamptz,
  purchase_status text,
  branch_id uuid,
  branch_name text,
  operator_key text,
  operator_name text,
  operator_kind text,
  ticket_number text,
  amount_minor bigint,
  latitude numeric,
  longitude numeric,
  branch_latitude numeric,
  branch_longitude numeric,
  geofence_radius_meters integer,
  distance_meters integer,
  location_result text
)
language plpgsql
volatile
security definer
set search_path = public, app, auth, extensions
as $$
#variable_conflict use_column
declare
  staff_record record;
  returned_count integer;
  period_start timestamptz;
  period_end timestamptz;
begin
  select sp.id, sp.tenant_id, sp.role, t.timezone
    into staff_record
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
    and sp.status = 'ACTIVE'
    and sp.role in ('ADMIN', 'MANAGER')
    and t.status = 'ACTIVE';

  if staff_record.id is null then
    raise exception 'location review is restricted to administrators' using errcode = '42501';
  end if;

  -- Calendar days in the tenant's time zone; target_to is inclusive.
  if target_from is null or target_to is null or target_to < target_from
    or target_to - target_from > 92 then
    raise exception 'invalid review period' using errcode = '22023';
  end if;
  period_start := target_from::timestamp at time zone staff_record.timezone;
  period_end := (target_to + 1)::timestamp at time zone staff_record.timezone;

  if target_result is not null
    and target_result not in ('INSIDE', 'OUTSIDE', 'NO_COORDINATES', 'NO_BRANCH_POINT') then
    raise exception 'invalid location result filter' using errcode = '22023';
  end if;

  return query
  with scoped as (
    select
      p.id,
      p.occurred_at,
      p.status::text as purchase_status,
      b.id as branch_id,
      b.name as branch_name,
      case when p.pin_operator_id is not null then 'pin:' || p.pin_operator_id::text
           else 'staff:' || p.staff_profile_id::text end as operator_key,
      coalesce(pin.full_name, staff.full_name) as operator_name,
      case when p.pin_operator_id is not null then 'PIN' else 'STAFF' end as operator_kind,
      p.ticket_number,
      p.amount_minor,
      p.latitude,
      p.longitude,
      b.latitude as branch_latitude,
      b.longitude as branch_longitude,
      b.geofence_radius_meters,
      case
        when p.latitude is null or p.longitude is null or b.latitude is null or b.longitude is null then null
        else round(6371000 * 2 * asin(sqrt(least(1::numeric, greatest(0::numeric,
          sin(radians((p.latitude - b.latitude) / 2)) ^ 2
          + cos(radians(b.latitude)) * cos(radians(p.latitude))
          * sin(radians((p.longitude - b.longitude) / 2)) ^ 2)))))::integer
      end as distance_meters
    from public.purchases p
    join public.branches b on b.id = p.branch_id and b.tenant_id = p.tenant_id
    left join public.staff_profiles staff on staff.id = p.staff_profile_id
    left join public.branch_pin_operators pin on pin.id = p.pin_operator_id
    where p.tenant_id = staff_record.tenant_id
      and p.occurred_at >= period_start
      and p.occurred_at < period_end
      and (target_branch_id is null or p.branch_id = target_branch_id)
      and (
        staff_record.role = 'ADMIN'
        or exists (
          select 1 from public.staff_branch_assignments sba
          where sba.staff_profile_id = staff_record.id
            and sba.branch_id = p.branch_id
        )
      )
  ), classified as (
    select scoped.*,
      case
        when latitude is null or longitude is null then 'NO_COORDINATES'
        when branch_latitude is null or branch_longitude is null then 'NO_BRANCH_POINT'
        when distance_meters > geofence_radius_meters then 'OUTSIDE'
        else 'INSIDE'
      end as location_result
    from scoped
  )
  select
    classified.id, classified.occurred_at, classified.purchase_status,
    classified.branch_id, classified.branch_name, classified.operator_key,
    classified.operator_name, classified.operator_kind, classified.ticket_number,
    classified.amount_minor, classified.latitude, classified.longitude,
    classified.branch_latitude, classified.branch_longitude,
    classified.geofence_radius_meters, classified.distance_meters,
    classified.location_result
  from classified
  where (target_operator_key is null or classified.operator_key = target_operator_key)
    and (target_result is null or classified.location_result = target_result)
  order by classified.occurred_at desc
  limit 1000;

  get diagnostics returned_count = row_count;

  insert into public.audit_logs (
    tenant_id, actor_staff_id, action, entity_type, entity_id, metadata
  ) values (
    staff_record.tenant_id, staff_record.id,
    'PURCHASE_LOCATION_REVIEW_VIEWED', 'purchases', null,
    jsonb_build_object(
      'from', target_from,
      'to', target_to,
      'timezone', staff_record.timezone,
      'branch_id', target_branch_id,
      'operator_key', target_operator_key,
      'result', target_result,
      'rows', returned_count
    )
  );
end;
$$;

revoke all on function app.get_purchase_location_review(date, date, uuid, text, text)
from public, anon;
grant execute on function app.get_purchase_location_review(date, date, uuid, text, text)
to authenticated;
