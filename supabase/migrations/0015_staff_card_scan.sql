-- Internal scan projection. A scanned token is useful only after tenant validation.

create or replace function app.resolve_staff_card_scan(target_card_token text)
returns table (result text, customer_id uuid, customer_name text)
language plpgsql security definer
set search_path = public, app, auth, extensions
as $$
declare
  staff_tenant_id uuid;
  card_record record;
begin
  select sp.tenant_id into staff_tenant_id
  from public.staff_profiles sp join public.tenants t on t.id = sp.tenant_id
  where sp.id = auth.uid() and sp.status = 'ACTIVE' and t.status = 'ACTIVE';
  if staff_tenant_id is null then
    return query select 'UNAVAILABLE', null::uuid, null::text;
    return;
  end if;

  select cc.tenant_id, cc.customer_id, c.full_name into card_record
  from public.customer_cards cc join public.customers c on c.id = cc.customer_id
  where cc.public_token = target_card_token and cc.status = 'ACTIVE' and c.status = 'ACTIVE';
  if not found or card_record.tenant_id is distinct from staff_tenant_id then
    return query select 'NOT_THIS_TENANT', null::uuid, null::text;
    return;
  end if;
  return query select 'FOUND', card_record.customer_id, card_record.full_name;
end;
$$;

revoke all on function app.resolve_staff_card_scan(text) from public, anon;
grant execute on function app.resolve_staff_card_scan(text) to authenticated;
