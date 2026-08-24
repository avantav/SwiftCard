\set ON_ERROR_STOP on

select id as lifecycle_published_card_id
from public.loyalty_cards
where tenant_id = '10000000-0000-0000-0000-000000000001'
  and status = 'PUBLISHED'
order by published_at
limit 1\gset

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare
  result_value text;
  card_id_value uuid;
  published_card_id uuid := (
    select id from public.loyalty_cards
    where tenant_id = '10000000-0000-0000-0000-000000000001'
      and status = 'PUBLISHED'
    order by published_at
    limit 1
  );
  center_card_id uuid := (
    select id from public.loyalty_cards
    where tenant_id = '10000000-0000-0000-0000-000000000001'
      and name = 'Tarjeta Centro'
    limit 1
  );
begin
  select result, loyalty_card_id into result_value, card_id_value
  from app.create_loyalty_card_draft('  tarjeta centro  ');
  if result_value <> 'EXISTS'
    or card_id_value <> center_card_id then
    raise exception 'Duplicate draft was not consolidated';
  end if;

  if app.archive_loyalty_card(center_card_id) <> 'DISCARDED' then
    raise exception 'Admin could not discard a draft';
  end if;
  if app.restore_loyalty_card(center_card_id) <> 'RESTORED' then
    raise exception 'Admin could not restore a discarded draft';
  end if;
  if app.archive_loyalty_card(center_card_id) <> 'DISCARDED' then
    raise exception 'Admin could not discard the restored draft';
  end if;
  if app.delete_archived_loyalty_card(center_card_id) <> 'DELETED' then
    raise exception 'Unused archived draft was not deleted';
  end if;

  if app.archive_loyalty_card(published_card_id) <> 'DEACTIVATED' then
    raise exception 'Admin could not deactivate a published card';
  end if;
  if app.delete_archived_loyalty_card(published_card_id) <> 'HAS_HISTORY' then
    raise exception 'Card with issued history was deleted';
  end if;
  if app.restore_loyalty_card(published_card_id) <> 'RESTORED' then
    raise exception 'Admin could not restore a deactivated card';
  end if;
end;
$$;

reset role;

insert into public.customers (
  id, tenant_id, full_name, normalized_phone, privacy_consent,
  registration_method, source_branch_id
) values (
  '30000000-0000-0000-0000-000000000099',
  '10000000-0000-0000-0000-000000000001',
  'Cliente eliminable', '+528100000099', true, 'SELF_SERVICE',
  '20000000-0000-0000-0000-000000000001'
);
insert into public.customer_cards (tenant_id, customer_id, loyalty_card_id)
values (
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000099',
  :'lifecycle_published_card_id'::uuid
);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
declare
  history_customer_id uuid;
begin
  if app.set_admin_customer_status(
    '30000000-0000-0000-0000-000000000099', 'INACTIVE'
  ) <> 'UPDATED' then
    raise exception 'Admin could not deactivate a customer';
  end if;
  if app.set_admin_customer_status(
    '30000000-0000-0000-0000-000000000099', 'ACTIVE'
  ) <> 'UPDATED' then
    raise exception 'Admin could not reactivate a customer';
  end if;
  if app.delete_admin_customer(
    '30000000-0000-0000-0000-000000000099'
  ) <> 'DELETED' then
    raise exception 'Customer without history was not deleted';
  end if;

  select customer.id into history_customer_id
  from public.customers customer
  where customer.normalized_phone = '+528199998888';
  if app.delete_admin_customer(history_customer_id) <> 'HAS_HISTORY' then
    raise exception 'Customer with operational history was deleted';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);

do $$
declare
  south_card_id uuid := (
    select id from public.loyalty_cards
    where tenant_id = '10000000-0000-0000-0000-000000000001'
      and name = 'Tarjeta Sur'
    limit 1
  );
begin
  if app.archive_loyalty_card(south_card_id) <> 'UNAVAILABLE' then
    raise exception 'Branch-scoped staff archived a tenant card';
  end if;
  if app.set_admin_customer_status(
    '30000000-0000-0000-0000-000000000001', 'INACTIVE'
  ) <> 'UNAVAILABLE' then
    raise exception 'Branch-scoped staff changed a customer through the Admin-only RPC';
  end if;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1 from public.customers
    where id = '30000000-0000-0000-0000-000000000099'
  ) then
    raise exception 'Deleted customer still exists';
  end if;
  if not exists (
    select 1 from public.audit_logs
    where action = 'CUSTOMER_DELETED'
      and entity_id = '30000000-0000-0000-0000-000000000099'
  ) then
    raise exception 'Customer deletion was not audited';
  end if;
end;
$$;

select 'Admin card and customer lifecycle assertions passed' as result;
