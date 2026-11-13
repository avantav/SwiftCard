-- Advanced statistics are part of the Empresarial plan (DEC-0069).
-- Same entitlement as campaigns (DEC-0068): an ACTIVE/TRIALING `empresarial`
-- subscription or `tenants.campaigns_enabled`, which now means «Empresarial
-- features enabled by Superadmin». Without it, get_customer_insights returns
-- only the period summary and rewards; segment member lists are denied.

-- Keep the full computation as an internal function and wrap it.
alter function app.get_customer_insights(date, date, uuid) rename to customer_insights_full;
revoke all on function app.customer_insights_full(date, date, uuid) from public, anon, authenticated;

alter function app.get_customer_segment_members(text, uuid) rename to customer_segment_members_full;
revoke all on function app.customer_segment_members_full(text, uuid) from public, anon, authenticated;

create or replace function app.current_tenant_empresarial_available()
returns boolean
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select coalesce(app.tenant_campaigns_available(app.current_staff_tenant_id()), false);
$$;

create function app.get_customer_insights(
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
  result jsonb;
begin
  -- Authorization, scope and period validation happen in the full function.
  result := app.customer_insights_full(target_from, target_to, target_branch_id);
  if app.tenant_campaigns_available(app.current_staff_tenant_id()) then
    return result || jsonb_build_object('advanced', true);
  end if;
  return (result - 'segments' - 'funnel' - 'weekly' - 'heatmap' - 'top_customers' - 'branches')
    || jsonb_build_object('advanced', false);
end;
$$;

create function app.get_customer_segment_members(
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
begin
  if not coalesce(app.tenant_campaigns_available(app.current_staff_tenant_id()), false) then
    raise exception 'segment lists are part of the Empresarial plan' using errcode = '42501';
  end if;
  return query select * from app.customer_segment_members_full(target_segment, target_branch_id);
end;
$$;

revoke all on function app.current_tenant_empresarial_available() from public, anon;
revoke all on function app.get_customer_insights(date, date, uuid) from public, anon;
revoke all on function app.get_customer_segment_members(text, uuid) from public, anon;
grant execute on function app.current_tenant_empresarial_available() to authenticated;
grant execute on function app.get_customer_insights(date, date, uuid) to authenticated;
grant execute on function app.get_customer_segment_members(text, uuid) to authenticated;

comment on column public.tenants.campaigns_enabled is
  'Empresarial features (campaigns and advanced statistics) enabled by Superadmin without a subscription record.';
