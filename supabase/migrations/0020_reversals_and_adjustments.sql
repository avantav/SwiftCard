create type public.reward_redemption_status as enum ('COMPLETED', 'REVERSED');
alter table public.reward_redemptions add column status public.reward_redemption_status not null default 'COMPLETED';
alter table public.reward_redemptions add column reversed_at timestamptz;
alter table public.reward_redemptions add column reversed_by_staff_id uuid references public.staff_profiles(id) on delete set null;
alter table public.reward_redemptions add column reversal_reason text;
alter table public.reward_redemptions drop constraint reward_redemptions_reward_id_key;
create unique index reward_redemptions_completed_unique_idx on public.reward_redemptions (reward_id) where status = 'COMPLETED';

create table public.stamp_adjustments (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete restrict,
  stamps_delta integer not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint stamp_adjustments_delta_nonzero check (stamps_delta <> 0),
  constraint stamp_adjustments_reason_not_blank check (length(btrim(reason)) > 0)
);

create index stamp_adjustments_customer_created_idx on public.stamp_adjustments (customer_id, created_at desc);
alter type public.stamp_ledger_entry_type add value if not exists 'ADJUSTMENT';

create or replace function app.reverse_reward_redemption(target_redemption_id uuid, target_reason text)
returns text language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
declare staff_record record; redemption_record record; reward_record record;
begin
  if nullif(btrim(target_reason), '') is null then return 'INVALID'; end if;
  select sp.id, sp.tenant_id into staff_record from public.staff_profiles sp join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid() and sp.status = 'ACTIVE' and t.status = 'ACTIVE';
  select rr.*, b.tenant_id as branch_tenant_id into redemption_record
  from public.reward_redemptions rr join public.branches b on b.id = rr.branch_id
  where rr.id = target_redemption_id for update;
  if staff_record.id is null or redemption_record.id is null or redemption_record.status <> 'COMPLETED'
    or redemption_record.branch_tenant_id is distinct from staff_record.tenant_id
    or not (app.current_staff_can_manage_tenant(redemption_record.tenant_id)
      or (app.current_staff_role() = 'MANAGER' and app.current_staff_can_access_branch(redemption_record.branch_id))) then
    return 'UNAVAILABLE';
  end if;
  select * into reward_record from public.rewards where id = redemption_record.reward_id for update;
  update public.rewards set status = 'AVAILABLE', redeemed_at = null where id = redemption_record.reward_id;
  update public.reward_redemptions set status = 'REVERSED', reversed_at = now(), reversed_by_staff_id = staff_record.id, reversal_reason = btrim(target_reason) where id = target_redemption_id;
  return 'REVERSED';
end;
$$;

create or replace function app.adjust_customer_stamps(
  target_customer_id uuid, target_branch_id uuid, target_stamps_delta integer, target_reason text
)
returns text language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
declare staff_record record; customer_record record; balance_record record; next_balance integer; adjustment_id_value uuid;
begin
  if target_stamps_delta = 0 or nullif(btrim(target_reason), '') is null then return 'INVALID'; end if;
  select sp.id, sp.tenant_id into staff_record from public.staff_profiles sp join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid() and sp.status = 'ACTIVE' and t.status = 'ACTIVE';
  select c.* into customer_record from public.customers c where c.id = target_customer_id and c.status = 'ACTIVE';
  if staff_record.id is null or customer_record.tenant_id is distinct from staff_record.tenant_id
    or not (app.current_staff_can_manage_tenant(customer_record.tenant_id)
      or (app.current_staff_role() = 'MANAGER' and app.current_staff_can_access_branch(target_branch_id)))
    or not exists (select 1 from public.branches b where b.id = target_branch_id and b.tenant_id = staff_record.tenant_id and b.status = 'ACTIVE') then
    return 'UNAVAILABLE';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('swiftwallet:customer-balance:' || target_customer_id::text, 0));
  select * into balance_record from public.customer_loyalty_balances where customer_id = target_customer_id for update;
  if not found then
    insert into public.customer_loyalty_balances (tenant_id, customer_id) values (staff_record.tenant_id, target_customer_id);
    select * into balance_record from public.customer_loyalty_balances where customer_id = target_customer_id for update;
  end if;
  next_balance := balance_record.stamp_balance + target_stamps_delta;
  if next_balance < 0 then return 'NEGATIVE_BALANCE'; end if;
  update public.customer_loyalty_balances set stamp_balance = next_balance, updated_at = now() where customer_id = target_customer_id;
  insert into public.stamp_adjustments (tenant_id, customer_id, branch_id, staff_profile_id, stamps_delta, reason)
  values (staff_record.tenant_id, target_customer_id, target_branch_id, staff_record.id, target_stamps_delta, btrim(target_reason)) returning id into adjustment_id_value;
  insert into public.stamp_ledger (tenant_id, customer_id, entry_type, stamps_delta, balance_after, remainder_after_minor, reason, created_by_staff_id)
  values (staff_record.tenant_id, target_customer_id, 'ADJUSTMENT', target_stamps_delta, next_balance, balance_record.remainder_minor, btrim(target_reason), staff_record.id);
  return 'ADJUSTED';
end;
$$;

create or replace function app.audit_sensitive_change()
returns trigger language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
declare actor_id uuid := auth.uid(); tenant_value uuid; action_value text; entity_value uuid; metadata_value jsonb;
begin
  if tg_table_name = 'customers' then
    tenant_value := new.tenant_id; entity_value := new.id; action_value := case when tg_op = 'INSERT' then 'CUSTOMER_CREATED' else 'CUSTOMER_UPDATED' end; metadata_value := jsonb_build_object('status', new.status, 'registration_method', new.registration_method);
  elsif tg_table_name = 'purchases' then
    tenant_value := new.tenant_id; entity_value := new.id; action_value := case when tg_op = 'INSERT' then 'PURCHASE_CONFIRMED' else 'PURCHASE_CANCELLED' end; metadata_value := jsonb_build_object('branch_id', new.branch_id, 'amount_minor', new.amount_minor, 'ticket_number', new.ticket_number);
  elsif tg_table_name = 'reward_redemptions' then
    tenant_value := new.tenant_id; entity_value := new.reward_id; action_value := case when tg_op = 'INSERT' then 'REWARD_REDEEMED' else 'REWARD_REDEMPTION_REVERSED' end; metadata_value := jsonb_build_object('branch_id', new.branch_id, 'redemption_id', new.id);
  elsif tg_table_name = 'stamp_adjustments' then
    tenant_value := new.tenant_id; entity_value := new.id; action_value := 'STAMP_ADJUSTMENT'; metadata_value := jsonb_build_object('branch_id', new.branch_id, 'stamps_delta', new.stamps_delta, 'reason', new.reason);
  end if;
  insert into public.audit_logs (tenant_id, actor_staff_id, action, entity_type, entity_id, metadata) values (tenant_value, actor_id, action_value, tg_table_name, entity_value, metadata_value);
  return new;
end;
$$;
create trigger adjustments_audit_insert after insert on public.stamp_adjustments for each row execute function app.audit_sensitive_change();
create trigger redemptions_audit_update after update on public.reward_redemptions for each row execute function app.audit_sensitive_change();

alter table public.stamp_adjustments enable row level security;
alter table public.stamp_adjustments force row level security;
create policy stamp_adjustments_staff_read on public.stamp_adjustments for select to authenticated using (app.current_staff_can_access_branch(branch_id));
revoke all on public.stamp_adjustments from anon;
grant select on public.stamp_adjustments to authenticated;
revoke all on function app.reverse_reward_redemption(uuid, text), app.adjust_customer_stamps(uuid, uuid, integer, text) from public, anon;
grant execute on function app.reverse_reward_redemption(uuid, text), app.adjust_customer_stamps(uuid, uuid, integer, text) to authenticated;
