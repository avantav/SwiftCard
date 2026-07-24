create table public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete restrict,
  actor_staff_id uuid references public.staff_profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_not_blank check (length(btrim(action)) > 0),
  constraint audit_logs_entity_not_blank check (length(btrim(entity_type)) > 0),
  constraint audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index audit_logs_tenant_created_idx on public.audit_logs (tenant_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);

create or replace function app.prevent_audit_log_mutation()
returns trigger language plpgsql
as $$
begin
  raise exception 'audit logs are append-only' using errcode = '42501';
end;
$$;

create trigger audit_logs_no_update before update on public.audit_logs
  for each row execute function app.prevent_audit_log_mutation();
create trigger audit_logs_no_delete before delete on public.audit_logs
  for each row execute function app.prevent_audit_log_mutation();

create or replace function app.audit_sensitive_change()
returns trigger language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
declare actor_id uuid := auth.uid(); tenant_value uuid; action_value text; entity_value uuid; metadata_value jsonb;
begin
  if tg_table_name = 'customers' then
    tenant_value := new.tenant_id;
    entity_value := new.id;
    action_value := case when tg_op = 'INSERT' then 'CUSTOMER_CREATED' else 'CUSTOMER_UPDATED' end;
    metadata_value := jsonb_build_object('status', new.status, 'registration_method', new.registration_method);
  elsif tg_table_name = 'purchases' then
    tenant_value := new.tenant_id; entity_value := new.id; action_value := 'PURCHASE_CONFIRMED';
    metadata_value := jsonb_build_object('branch_id', new.branch_id, 'amount_minor', new.amount_minor, 'ticket_number', new.ticket_number);
  elsif tg_table_name = 'reward_redemptions' then
    tenant_value := new.tenant_id; entity_value := new.reward_id; action_value := 'REWARD_REDEEMED';
    metadata_value := jsonb_build_object('branch_id', new.branch_id, 'redemption_id', new.id);
  end if;
  insert into public.audit_logs (tenant_id, actor_staff_id, action, entity_type, entity_id, metadata)
  values (tenant_value, actor_id, action_value, tg_table_name, entity_value, metadata_value);
  return new;
end;
$$;

create trigger customers_audit_insert after insert on public.customers
  for each row execute function app.audit_sensitive_change();
create trigger customers_audit_update after update on public.customers
  for each row execute function app.audit_sensitive_change();
create trigger purchases_audit_insert after insert on public.purchases
  for each row execute function app.audit_sensitive_change();
create trigger redemptions_audit_insert after insert on public.reward_redemptions
  for each row execute function app.audit_sensitive_change();

alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;
create policy audit_logs_admin_read on public.audit_logs for select to authenticated
  using (app.current_staff_can_manage_tenant(tenant_id) or app.is_superadmin());
revoke all on public.audit_logs from anon;
grant select on public.audit_logs to authenticated;

-- Application paths may append only through security-definer triggers above.
revoke insert, update, delete on public.audit_logs from authenticated, anon;
