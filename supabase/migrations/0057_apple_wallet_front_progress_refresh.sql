-- Queue installed Apple passes after deploying the front reward count and the
-- graphical/textual lifetime-point progress fallback. Store-card strip images
-- are not rendered on iOS 26+, so the compact front fields remain authoritative.

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
