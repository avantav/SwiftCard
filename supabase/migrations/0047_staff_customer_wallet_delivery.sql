-- Let an authorized employee offer card delivery only when Apple has not
-- registered the issued pass on a customer device. Tenant and branch scope
-- are inherited from the existing staff customer-card summary projection.

create function app.get_staff_customer_wallet_delivery(target_customer_card_id uuid)
returns table (
  card_token text,
  apple_wallet_added boolean
)
language sql
stable
security definer
set search_path = public, app, auth, extensions
as $$
  select
    issued.public_token,
    exists (
      select 1
      from public.wallet_passes wallet_pass
      join public.apple_wallet_registrations registration
        on registration.wallet_pass_id = wallet_pass.id
      join public.apple_wallet_devices device
        on device.id = registration.device_id
        and device.status = 'ACTIVE'
      where wallet_pass.customer_card_id = issued.id
        and wallet_pass.provider = 'APPLE'
        and wallet_pass.status in ('ACTIVE', 'UPDATE_PENDING')
    )
  from public.customer_cards issued
  where issued.id = target_customer_card_id
    and issued.status = 'ACTIVE'
    and exists (
      select 1
      from app.get_staff_customer_card_summary(target_customer_card_id) summary
      where summary.customer_card_id = issued.id
    );
$$;

revoke all on function app.get_staff_customer_wallet_delivery(uuid) from public, anon, authenticated;
grant execute on function app.get_staff_customer_wallet_delivery(uuid) to authenticated;
