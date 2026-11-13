-- Campaigns for Empresarial tenants (DEC-0068). Explicitly authorized by the
-- owner as a post-MVP exception. Email and Wallet (Apple/Google) messages to
-- customer segments from app.customer_segment_snapshot (0075).
--   * Only the tenant Admin general, only tenants with an active/trialing
--     Empresarial subscription or campaigns enabled by Superadmin.
--   * Only customers with marketing consent.
--   * At most one campaign per customer every 7 days, across all channels.
--   * No coupons or promotions: informational messages only.

alter table public.tenants
  add column campaigns_enabled boolean not null default false;

create or replace function app.tenant_campaigns_available(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select coalesce((select t.campaigns_enabled from public.tenants t where t.id = target_tenant_id), false)
    or exists (
      select 1 from public.tenant_subscriptions s
      where s.tenant_id = target_tenant_id
        and s.ended_at is null
        and s.status in ('ACTIVE', 'TRIALING')
        and s.package_code_snapshot = 'empresarial'
    );
$$;

-- The caller's own tenant (for showing or hiding the Campaigns area).
create or replace function app.current_tenant_campaigns_available()
returns boolean
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select coalesce(app.tenant_campaigns_available(app.current_staff_tenant_id()), false);
$$;

create table public.marketing_campaigns (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  name text not null,
  segments text[] not null,
  branch_id uuid references public.branches(id) on delete set null,
  send_email boolean not null default false,
  email_subject text,
  email_body text,
  send_wallet boolean not null default false,
  wallet_message text,
  status text not null default 'SENDING',
  recipient_count integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint marketing_campaigns_name_length check (length(btrim(name)) between 1 and 80),
  constraint marketing_campaigns_status_valid check (status in ('SENDING', 'SENT')),
  constraint marketing_campaigns_channel_required check (send_email or send_wallet),
  constraint marketing_campaigns_email_content check (
    not send_email or (
      length(btrim(coalesce(email_subject, ''))) between 1 and 120
      and length(btrim(coalesce(email_body, ''))) between 1 and 1500
    )
  ),
  constraint marketing_campaigns_wallet_content check (
    not send_wallet or length(btrim(coalesce(wallet_message, ''))) between 1 and 120
  ),
  constraint marketing_campaigns_segments_valid check (
    cardinality(segments) between 1 and 7
    and segments <@ array['NEW', 'FREQUENT', 'OCCASIONAL', 'ONE_VISIT', 'AT_RISK', 'LOST', 'NEVER_PURCHASED']
  )
);

create index marketing_campaigns_tenant_idx on public.marketing_campaigns (tenant_id, created_at desc);

create table public.marketing_campaign_recipients (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete cascade,
  customer_card_id uuid not null references public.customer_cards(id) on delete cascade,
  wallet_pass_id uuid references public.wallet_passes(id) on delete cascade,
  channel text not null,
  status text not null default 'PENDING',
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_campaign_recipients_channel_valid check (channel in ('EMAIL', 'APPLE', 'GOOGLE')),
  constraint marketing_campaign_recipients_status_valid check (status in ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
  constraint marketing_campaign_recipients_wallet_pass check ((channel = 'EMAIL') = (wallet_pass_id is null)),
  constraint marketing_campaign_recipients_error_length check (last_error is null or length(last_error) <= 300),
  constraint marketing_campaign_recipients_unique unique (campaign_id, customer_card_id, channel)
);

create index marketing_campaign_recipients_customer_idx
  on public.marketing_campaign_recipients (customer_id, created_at desc);
create index marketing_campaign_recipients_pending_idx
  on public.marketing_campaign_recipients (campaign_id, status);

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaigns force row level security;
alter table public.marketing_campaign_recipients enable row level security;
alter table public.marketing_campaign_recipients force row level security;

create policy marketing_campaigns_admin_read on public.marketing_campaigns
  for select to authenticated
  using (app.current_staff_can_manage_tenant(tenant_id));
create policy marketing_campaign_recipients_admin_read on public.marketing_campaign_recipients
  for select to authenticated
  using (app.current_staff_can_manage_tenant(tenant_id));

revoke all on public.marketing_campaigns, public.marketing_campaign_recipients from public, anon, authenticated;
grant select on public.marketing_campaigns, public.marketing_campaign_recipients to authenticated;
grant select, update on public.marketing_campaigns, public.marketing_campaign_recipients to service_role;

-- Audience of a campaign for the calling Admin: segment members with their
-- consent, email, active cards and wallet passes, and the 7-day cap.
create or replace function app.campaign_audience(
  target_staff_id uuid,
  target_tenant_id uuid,
  target_segments text[],
  target_branch_id uuid
)
returns table (
  customer_id uuid,
  customer_card_id uuid,
  email text,
  consent boolean,
  capped boolean,
  apple_pass_id uuid,
  google_pass_id uuid
)
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  with members as (
    select s.customer_id
    from app.customer_segment_snapshot(target_staff_id, target_tenant_id, 'ADMIN', target_branch_id, now()) s
    where s.segment = any(target_segments)
  )
  select
    c.id,
    cc.id,
    nullif(btrim(c.email), ''),
    c.marketing_consent,
    exists (
      select 1 from public.marketing_campaign_recipients r
      where r.customer_id = c.id
        and r.status in ('PENDING', 'SENT')
        and r.created_at > now() - interval '7 days'
    ),
    (select wp.id from public.wallet_passes wp
      where wp.customer_card_id = cc.id and wp.provider = 'APPLE'
        and wp.status in ('ACTIVE', 'UPDATE_PENDING')
        and exists (select 1 from public.apple_wallet_registrations ar where ar.wallet_pass_id = wp.id)
      limit 1),
    (select wp.id from public.wallet_passes wp
      where wp.customer_card_id = cc.id and wp.provider = 'GOOGLE' and wp.status = 'ACTIVE'
      limit 1)
  from members m
  join public.customers c on c.id = m.customer_id
  join public.customer_cards cc on cc.customer_id = c.id and cc.tenant_id = c.tenant_id and cc.status = 'ACTIVE'
  where c.tenant_id = target_tenant_id;
$$;

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
    and app.tenant_campaigns_available(t.id);
$$;

create or replace function app.preview_marketing_campaign(
  target_segments text[],
  target_branch_id uuid default null
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

-- Superadmin switch for tenants without an Empresarial subscription record.
create or replace function app.set_tenant_campaigns_enabled(
  target_tenant_id uuid,
  target_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, app, auth, extensions
as $$
begin
  if not app.is_superadmin() then
    raise exception 'superadmin required' using errcode = '42501';
  end if;
  update public.tenants set campaigns_enabled = coalesce(target_enabled, false)
  where id = target_tenant_id;
  if not found then
    return false;
  end if;
  insert into public.audit_logs (tenant_id, actor_staff_id, action, entity_type, entity_id, metadata)
  values (target_tenant_id, auth.uid(), 'TENANT_CAMPAIGNS_UPDATED', 'tenants', target_tenant_id,
          jsonb_build_object('enabled', coalesce(target_enabled, false)));
  return true;
end;
$$;

revoke all on function app.tenant_campaigns_available(uuid) from public, anon, authenticated;
revoke all on function app.current_tenant_campaigns_available() from public, anon;
revoke all on function app.campaign_audience(uuid, uuid, text[], uuid) from public, anon, authenticated;
revoke all on function app.campaign_admin() from public, anon, authenticated;
revoke all on function app.preview_marketing_campaign(text[], uuid) from public, anon;
revoke all on function app.create_marketing_campaign(text, text[], uuid, boolean, text, text, boolean, text) from public, anon;
revoke all on function app.set_tenant_campaigns_enabled(uuid, boolean) from public, anon;
grant execute on function app.current_tenant_campaigns_available() to authenticated;
grant execute on function app.preview_marketing_campaign(text[], uuid) to authenticated;
grant execute on function app.create_marketing_campaign(text, text[], uuid, boolean, text, text, boolean, text) to authenticated;
grant execute on function app.set_tenant_campaigns_enabled(uuid, boolean) to authenticated;
