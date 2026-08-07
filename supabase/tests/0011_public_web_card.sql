\set ON_ERROR_STOP on

select public_token as card_token
from public.customer_cards
where customer_id = '30000000-0000-0000-0000-000000000001'\gset

set role anon;

select 1 / nullif(case when count(*) = 1 and max(customer_name) = 'Updated Customer' then 1 else 0 end, 0) as active_assertion
from app.get_public_web_card(:'card_token');

select 1 / nullif(case when count(*) = 0 then 1 else 0 end, 0) as unknown_assertion
from app.get_public_web_card('unknown-token');

reset role;
update public.customer_cards
set status = 'REVOKED', revoked_at = now()
where customer_id = '30000000-0000-0000-0000-000000000001';

set role anon;
select 1 / nullif(case when count(*) = 0 then 1 else 0 end, 0) as revoked_assertion
from app.get_public_web_card(:'card_token');
reset role;

select 'Public web card assertions passed' as result;
