-- Queue every installed Apple pass once after the tighter logo/header layout is
-- deployed. Deploy the application code before applying this migration so the
-- subsequent PassKit fetch receives the new pass.json and logo assets.

do $$
declare
  target_card_id uuid;
begin
  for target_card_id in
    select distinct issued.loyalty_card_id
    from public.wallet_passes wallet_pass
    join public.customer_cards issued
      on issued.id = wallet_pass.customer_card_id
    join public.apple_wallet_registrations registration
      on registration.wallet_pass_id = wallet_pass.id
    where wallet_pass.provider = 'APPLE'
      and wallet_pass.status in ('ACTIVE', 'UPDATE_PENDING', 'FAILED')
      and issued.loyalty_card_id is not null
  loop
    perform app.queue_apple_wallet_card_updates(target_card_id);
  end loop;
end;
$$;
