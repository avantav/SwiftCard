\set ON_ERROR_STOP on

select wallet_pass.id as design_wallet_pass_id,
       wallet_pass.update_tag as design_previous_update_tag,
       issued.loyalty_card_id as design_loyalty_card_id
from public.wallet_passes wallet_pass
join public.customer_cards issued on issued.id = wallet_pass.customer_card_id
join public.apple_wallet_registrations registration
  on registration.wallet_pass_id = wallet_pass.id
where wallet_pass.provider = 'APPLE'
  and issued.loyalty_card_id is not null
limit 1\gset

update public.loyalty_cards
set background_color = case background_color
  when '#123456' then '#654321'
  else '#123456'
end
where id = :'design_loyalty_card_id'::uuid;

select count(*) as design_update_count
from public.wallet_passes wallet_pass
join public.apple_wallet_update_outbox outbox
  on outbox.wallet_pass_id = wallet_pass.id
where wallet_pass.id = :'design_wallet_pass_id'::uuid
  and wallet_pass.status = 'UPDATE_PENDING'
  and wallet_pass.update_pending_at is not null
  and wallet_pass.update_tag > :'design_previous_update_tag'::bigint
  and outbox.update_tag = wallet_pass.update_tag\gset

select case when :'design_update_count' = '1' then 1 else 1 / 0 end
  as card_design_update_queued_assertion;

select update_tag as location_previous_update_tag
from public.wallet_passes
where id = :'design_wallet_pass_id'::uuid\gset

update public.loyalty_card_branches
set branch_id = branch_id
where loyalty_card_id = :'design_loyalty_card_id'::uuid;

select count(*) as location_update_count
from public.wallet_passes wallet_pass
join public.apple_wallet_update_outbox outbox
  on outbox.wallet_pass_id = wallet_pass.id
where wallet_pass.id = :'design_wallet_pass_id'::uuid
  and wallet_pass.update_tag > :'location_previous_update_tag'::bigint
  and outbox.update_tag = wallet_pass.update_tag\gset

select case when :'location_update_count' = '1' then 1 else 1 / 0 end
  as card_location_update_queued_assertion;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);

do $$
begin
  begin
    perform app.queue_apple_wallet_card_updates(
      '00000000-0000-0000-0000-000000000000'::uuid
    );
    raise exception 'Authenticated staff directly queued Apple Wallet updates';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;

select 'Apple Wallet card configuration update assertions passed' as result;
