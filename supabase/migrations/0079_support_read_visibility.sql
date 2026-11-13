-- Support mode can SEE everything of the tenant (DEC-0071).
-- Read RPCs accept an optional `target_support_token_hash`. When the caller is
-- an ACTIVE Superadmin with a matching, open and unexpired support session,
-- internal helpers treat the call as the tenant's Admin general (read only).
-- The token travels in a transaction-local setting so inner helpers do not
-- change their signatures. Writes keep their existing rules: campaigns cannot
-- be created from support (campaign_admin ignores the token for creation).

create or replace function app.support_session_tenant()
returns uuid
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select session.tenant_id
  from public.support_impersonation_sessions session
  join public.staff_profiles actor on actor.id = session.superadmin_staff_id
  join public.tenants tenant on tenant.id = session.tenant_id
  where nullif(current_setting('app.support_token_hash', true), '') is not null
    and session.token_hash = current_setting('app.support_token_hash', true)
    and session.superadmin_staff_id = auth.uid()
    and session.ended_at is null
    and session.expires_at > now()
    and actor.role = 'SUPERADMIN'
    and actor.status = 'ACTIVE'
    and tenant.status = 'ACTIVE'
  limit 1;
$$;

-- Tenant staff as before; otherwise the support session acting as ADMIN.
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
    and t.status = 'ACTIVE'
  union all
  select auth.uid(), t.id, 'ADMIN'::public.staff_role, t.timezone
  from public.tenants t
  where t.id = app.support_session_tenant()
  limit 1;
$$;

-- Campaign audience preview may run in support; creation never sets the token.
create or replace function app.campaign_admin()
returns table (staff_id uuid, tenant_id uuid)
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select sp.id, sp.tenant_id
  from public.staff_profiles sp
  join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid()
    and sp.status = 'ACTIVE'
    and sp.role = 'ADMIN'
    and t.status = 'ACTIVE'
    and app.tenant_campaigns_available(t.id)
  union all
  select auth.uid(), t.id
  from public.tenants t
  where t.id = app.support_session_tenant()
    and app.tenant_campaigns_available(t.id)
  limit 1;
$$;

-- Plan checks for the caller's tenant (or the supported tenant).
drop function app.current_tenant_campaigns_available();
create function app.current_tenant_campaigns_available(target_support_token_hash text default null)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app, auth, extensions
as $$
begin
  perform set_config('app.support_token_hash', coalesce(target_support_token_hash, ''), true);
  return coalesce(app.tenant_campaigns_available(coalesce(app.current_staff_tenant_id(), app.support_session_tenant())), false);
end;
$$;

drop function app.current_tenant_empresarial_available();
create function app.current_tenant_empresarial_available(target_support_token_hash text default null)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app, auth, extensions
as $$
begin
  perform set_config('app.support_token_hash', coalesce(target_support_token_hash, ''), true);
  return coalesce(app.tenant_campaigns_available(coalesce(app.current_staff_tenant_id(), app.support_session_tenant())), false);
end;
$$;

-- Statistics wrappers (0077) with the support token.
drop function app.get_customer_insights(date, date, uuid);
create function app.get_customer_insights(
  target_from date,
  target_to date,
  target_branch_id uuid default null,
  target_support_token_hash text default null
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
  perform set_config('app.support_token_hash', coalesce(target_support_token_hash, ''), true);
  result := app.customer_insights_full(target_from, target_to, target_branch_id);
  if app.tenant_campaigns_available((select s.tenant_id from app.insight_staff() s)) then
    return result || jsonb_build_object('advanced', true);
  end if;
  return (result - 'segments' - 'funnel' - 'weekly' - 'heatmap' - 'top_customers' - 'branches')
    || jsonb_build_object('advanced', false);
end;
$$;

drop function app.get_customer_segment_members(text, uuid);
create function app.get_customer_segment_members(
  target_segment text,
  target_branch_id uuid default null,
  target_support_token_hash text default null
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
  perform set_config('app.support_token_hash', coalesce(target_support_token_hash, ''), true);
  if not coalesce(app.tenant_campaigns_available((select s.tenant_id from app.insight_staff() s)), false) then
    raise exception 'segment lists are part of the Empresarial plan' using errcode = '42501';
  end if;
  return query select * from app.customer_segment_members_full(target_segment, target_branch_id);
end;
$$;

-- Campaign audience preview with the support token.
drop function app.preview_marketing_campaign(text[], uuid);
create function app.preview_marketing_campaign(
  target_segments text[],
  target_branch_id uuid default null,
  target_support_token_hash text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, auth, extensions
as $$
declare
  admin record;
  result jsonb;
begin
  perform set_config('app.support_token_hash', coalesce(target_support_token_hash, ''), true);
  select * into admin from app.campaign_admin();
  if admin.staff_id is null then
    raise exception 'campaigns are not available' using errcode = '42501';
  end if;
  if target_segments is null or cardinality(target_segments) = 0
    or not target_segments <@ array['NEW', 'FREQUENT', 'OCCASIONAL', 'ONE_VISIT', 'AT_RISK', 'LOST', 'NEVER_PURCHASED'] then
    raise exception 'invalid segments' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'customers', count(distinct a.customer_id),
    'without_consent', count(distinct a.customer_id) filter (where not a.consent),
    'capped', count(distinct a.customer_id) filter (where a.consent and a.capped),
    'email', count(distinct a.customer_id) filter (where a.consent and not a.capped and a.email is not null),
    'wallet', count(distinct a.customer_id) filter (where a.consent and not a.capped and (a.apple_pass_id is not null or a.google_pass_id is not null)),
    'apple', count(a.apple_pass_id) filter (where a.consent and not a.capped),
    'google', count(a.google_pass_id) filter (where a.consent and not a.capped)
  ) into result
  from app.campaign_audience(admin.staff_id, admin.tenant_id, target_segments, target_branch_id) a;

  return result;
end;
$$;


-- Location review (0074) with the support token.
drop function app.get_purchase_location_review(date, date, uuid, text, text);
create function app.get_purchase_location_review(
  target_from date,
  target_to date,
  target_branch_id uuid default null,
  target_operator_key text default null,
  target_result text default null,
  target_support_token_hash text default null
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
  perform set_config('app.support_token_hash', coalesce(target_support_token_hash, ''), true);
  select s.staff_id as id, s.tenant_id, s.role, s.timezone
    into staff_record
  from app.insight_staff() s;

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


-- Creation clears any support token first (defense in depth).
create or replace function app.create_marketing_campaign(
  target_name text,
  target_segments text[],
  target_branch_id uuid,
  target_send_email boolean,
  target_email_subject text,
  target_email_body text,
  target_send_wallet boolean,
  target_wallet_message text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, app, auth, extensions
as $$
declare
  admin record;
  campaign_id_value uuid;
  recipient_total integer;
  changed_pass record;
begin
  -- Never create campaigns with support-session authority (DEC-0071).
  perform set_config('app.support_token_hash', '', true);
  select * into admin from app.campaign_admin();
  if admin.staff_id is null then
    raise exception 'campaigns are not available' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('swiftwallet:campaigns:' || admin.tenant_id::text, 0));

  if exists (
    select 1 from public.marketing_campaigns mc
    where mc.tenant_id = admin.tenant_id and mc.created_at > now() - interval '1 minute'
  ) then
    raise exception 'wait before creating another campaign' using errcode = '55P03';
  end if;

  if target_branch_id is not null and not exists (
    select 1 from public.branches b
    where b.id = target_branch_id and b.tenant_id = admin.tenant_id and b.status = 'ACTIVE'
  ) then
    raise exception 'branch not available' using errcode = '42501';
  end if;

  insert into public.marketing_campaigns (
    tenant_id, created_by_staff_id, name, segments, branch_id,
    send_email, email_subject, email_body, send_wallet, wallet_message
  ) values (
    admin.tenant_id, admin.staff_id, btrim(target_name), target_segments, target_branch_id,
    coalesce(target_send_email, false), nullif(btrim(target_email_subject), ''), nullif(btrim(target_email_body), ''),
    coalesce(target_send_wallet, false), nullif(btrim(target_wallet_message), '')
  ) returning id into campaign_id_value;

  create temporary table campaign_audience_rows on commit drop as
  select * from app.campaign_audience(admin.staff_id, admin.tenant_id, target_segments, target_branch_id)
  where consent and not capped;

  if (select count(distinct customer_id) from campaign_audience_rows) > 5000 then
    raise exception 'campaign audience exceeds 5000 customers' using errcode = '54000';
  end if;

  if target_send_email then
    insert into public.marketing_campaign_recipients (campaign_id, tenant_id, customer_id, customer_card_id, channel)
    select distinct on (a.customer_id) campaign_id_value, admin.tenant_id, a.customer_id, a.customer_card_id, 'EMAIL'
    from campaign_audience_rows a
    where a.email is not null
    order by a.customer_id, a.customer_card_id;
  end if;

  if target_send_wallet then
    insert into public.marketing_campaign_recipients (campaign_id, tenant_id, customer_id, customer_card_id, wallet_pass_id, channel)
    select campaign_id_value, admin.tenant_id, a.customer_id, a.customer_card_id, a.apple_pass_id, 'APPLE'
    from campaign_audience_rows a where a.apple_pass_id is not null
    union all
    select campaign_id_value, admin.tenant_id, a.customer_id, a.customer_card_id, a.google_pass_id, 'GOOGLE'
    from campaign_audience_rows a where a.google_pass_id is not null;

    -- Apple shows the campaign as the pass's latest activity: queue a pass update.
    for changed_pass in
      update public.wallet_passes wp
         set update_tag = nextval('public.apple_wallet_update_tag_seq'),
             status = 'UPDATE_PENDING',
             update_pending_at = now(),
             last_error = null
       where wp.id in (
         select r.wallet_pass_id from public.marketing_campaign_recipients r
         where r.campaign_id = campaign_id_value and r.channel = 'APPLE'
       )
      returning wp.id, wp.update_tag
    loop
      insert into public.apple_wallet_update_outbox (wallet_pass_id, update_tag)
      values (changed_pass.id, changed_pass.update_tag)
      on conflict (wallet_pass_id) do update
        set update_tag = excluded.update_tag,
            attempt_count = 0,
            next_attempt_at = now(),
            last_error = null,
            claim_token = null,
            locked_until = null,
            updated_at = now();
    end loop;
  end if;

  select count(*) into recipient_total
  from public.marketing_campaign_recipients r where r.campaign_id = campaign_id_value;

  if recipient_total = 0 then
    raise exception 'campaign has no eligible recipients' using errcode = '22023';
  end if;

  update public.marketing_campaigns set recipient_count = recipient_total where id = campaign_id_value;

  insert into public.audit_logs (tenant_id, actor_staff_id, action, entity_type, entity_id, metadata)
  values (
    admin.tenant_id, admin.staff_id, 'MARKETING_CAMPAIGN_CREATED', 'marketing_campaigns', campaign_id_value,
    jsonb_build_object(
      'segments', target_segments,
      'branch_id', target_branch_id,
      'send_email', target_send_email,
      'send_wallet', target_send_wallet,
      'recipients', recipient_total
    )
  );

  return campaign_id_value;
end;
$$;


-- Campaign history is visible to Superadmin (pages filter by tenant).
create policy marketing_campaigns_superadmin_read on public.marketing_campaigns
  for select to authenticated using (app.is_superadmin());
create policy marketing_campaign_recipients_superadmin_read on public.marketing_campaign_recipients
  for select to authenticated using (app.is_superadmin());

revoke all on function app.support_session_tenant() from public, anon, authenticated;
revoke all on function app.current_tenant_campaigns_available(text) from public, anon;
revoke all on function app.current_tenant_empresarial_available(text) from public, anon;
revoke all on function app.get_customer_insights(date, date, uuid, text) from public, anon;
revoke all on function app.get_customer_segment_members(text, uuid, text) from public, anon;
revoke all on function app.preview_marketing_campaign(text[], uuid, text) from public, anon;
revoke all on function app.get_purchase_location_review(date, date, uuid, text, text, text) from public, anon;
grant execute on function app.current_tenant_campaigns_available(text) to authenticated;
grant execute on function app.current_tenant_empresarial_available(text) to authenticated;
grant execute on function app.get_customer_insights(date, date, uuid, text) to authenticated;
grant execute on function app.get_customer_segment_members(text, uuid, text) to authenticated;
grant execute on function app.preview_marketing_campaign(text[], uuid, text) to authenticated;
grant execute on function app.get_purchase_location_review(date, date, uuid, text, text, text) to authenticated;
