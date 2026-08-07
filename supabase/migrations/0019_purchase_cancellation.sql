create or replace function app.cancel_purchase(
  target_purchase_id uuid,
  target_reason text
)
returns text
language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_record record;
  purchase_record record;
  balance_record record;
  previous_balance integer;
begin
  if nullif(btrim(target_reason), '') is null then return 'INVALID'; end if;
  select sp.id, sp.tenant_id into staff_record
  from public.staff_profiles sp join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid() and sp.status = 'ACTIVE' and t.status = 'ACTIVE';
  select p.* into purchase_record from public.purchases p where p.id = target_purchase_id for update;
  if staff_record.id is null or purchase_record.id is null or purchase_record.status <> 'CONFIRMED'
    or not (app.current_staff_can_manage_tenant(purchase_record.tenant_id)
      or (app.current_staff_role() = 'MANAGER' and app.current_staff_can_access_branch(purchase_record.branch_id))) then
    return 'UNAVAILABLE';
  end if;
  if exists (select 1 from public.stamp_ledger sl where sl.customer_id = purchase_record.customer_id and sl.created_at > purchase_record.created_at) then
    return 'HAS_LATER_ACTIVITY';
  end if;
  if exists (select 1 from public.rewards r where r.source_purchase_id = purchase_record.id and r.status = 'REDEEMED') then
    return 'REWARD_ALREADY_REDEEMED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('swiftwallet:customer-balance:' || purchase_record.customer_id::text, 0));
  select * into balance_record from public.customer_loyalty_balances where customer_id = purchase_record.customer_id for update;
  previous_balance := balance_record.stamp_balance - purchase_record.stamps_awarded
    + (select coalesce(sum(lp.reward_stamp_goal), 0)
       from public.rewards r
       join public.loyalty_programs lp on lp.id = r.program_id
       where r.source_purchase_id = purchase_record.id);
  update public.customer_loyalty_balances
  set stamp_balance = previous_balance, remainder_minor = purchase_record.remainder_before_minor, updated_at = now()
  where customer_id = purchase_record.customer_id;
  update public.rewards set status = 'CANCELLED' where source_purchase_id = purchase_record.id and status = 'AVAILABLE';
  insert into public.stamp_ledger (tenant_id, customer_id, entry_type, purchase_id, stamps_delta, balance_after, remainder_after_minor, reason, created_by_staff_id)
  values (purchase_record.tenant_id, purchase_record.customer_id, 'CANCELLATION', purchase_record.id, -purchase_record.stamps_awarded, previous_balance, purchase_record.remainder_before_minor, btrim(target_reason), staff_record.id);
  update public.purchases
  set status = 'CANCELLED', cancelled_at = now(), cancelled_by_staff_id = staff_record.id, cancellation_reason = btrim(target_reason)
  where id = purchase_record.id;
  return 'CANCELLED';
end;
$$;

revoke all on function app.cancel_purchase(uuid, text) from public, anon;
grant execute on function app.cancel_purchase(uuid, text) to authenticated;

create trigger purchases_audit_update after update on public.purchases
  for each row execute function app.audit_sensitive_change();
