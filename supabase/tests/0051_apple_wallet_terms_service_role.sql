\set ON_ERROR_STOP on

set role service_role;

do $$
begin
  perform app.public_card_terms_are_accepted('invalid-card-token');
end;
$$;

reset role;

select 'Apple Wallet terms service-role permission assertion passed' as result;
