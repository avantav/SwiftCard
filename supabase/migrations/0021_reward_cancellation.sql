create or replace function app.cancel_reward(target_reward_id uuid, target_reason text)
returns text language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
declare staff_record record; reward_record record;
begin
  if nullif(btrim(target_reason), '') is null then return 'INVALID'; end if;
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid() and sp.status = 'ACTIVE' and t.status = 'ACTIVE' and sp.role = 'ADMIN';
  select * into reward_record from public.rewards where id = target_reward_id for update;
  if staff_record.id is null or reward_record.id is null or reward_record.tenant_id is distinct from staff_record.tenant_id
    or reward_record.status <> 'AVAILABLE' then
    return 'UNAVAILABLE';
  end if;
  update public.rewards set status = 'CANCELLED' where id = target_reward_id;
  return 'CANCELLED';
end;
$$;

revoke all on function app.cancel_reward(uuid, text) from public, anon;
grant execute on function app.cancel_reward(uuid, text) to authenticated;

create or replace function app.audit_sensitive_change()
returns trigger language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
declare actor_id uuid := auth.uid(); tenant_value uuid; action_value text; entity_value uuid; metadata_value jsonb;
begin
  if tg_table_name = 'customers' then tenant_value := new.tenant_id; entity_value := new.id; action_value := case when tg_op = 'INSERT' then 'CUSTOMER_CREATED' else 'CUSTOMER_UPDATED' end; metadata_value := jsonb_build_object('status', new.status, 'registration_method', new.registration_method);
  elsif tg_table_name = 'purchases' then tenant_value := new.tenant_id; entity_value := new.id; action_value := case when tg_op = 'INSERT' then 'PURCHASE_CONFIRMED' else 'PURCHASE_CANCELLED' end; metadata_value := jsonb_build_object('branch_id', new.branch_id, 'amount_minor', new.amount_minor, 'ticket_number', new.ticket_number);
  elsif tg_table_name = 'reward_redemptions' then tenant_value := new.tenant_id; entity_value := new.reward_id; action_value := case when tg_op = 'INSERT' then 'REWARD_REDEEMED' else 'REWARD_REDEMPTION_REVERSED' end; metadata_value := jsonb_build_object('branch_id', new.branch_id, 'redemption_id', new.id);
  elsif tg_table_name = 'stamp_adjustments' then tenant_value := new.tenant_id; entity_value := new.id; action_value := 'STAMP_ADJUSTMENT'; metadata_value := jsonb_build_object('branch_id', new.branch_id, 'stamps_delta', new.stamps_delta, 'reason', new.reason);
  elsif tg_table_name = 'rewards' then tenant_value := new.tenant_id; entity_value := new.id; action_value := 'REWARD_CANCELLED'; metadata_value := jsonb_build_object('status', new.status);
  end if;
  insert into public.audit_logs (tenant_id, actor_staff_id, action, entity_type, entity_id, metadata) values (tenant_value, actor_id, action_value, tg_table_name, entity_value, metadata_value);
  return new;
end;
$$;

create trigger rewards_audit_update after update on public.rewards
  for each row execute function app.audit_sensitive_change();
