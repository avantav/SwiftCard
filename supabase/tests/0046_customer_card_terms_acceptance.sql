\set ON_ERROR_STOP on

select issued.public_token as claim_card_token,
       issued.id as claim_customer_card_id,
       program.version as claim_program_version
from public.customer_cards issued
join public.customers customer on customer.id = issued.customer_id
join public.loyalty_cards card on card.id = issued.loyalty_card_id
join public.loyalty_programs program on program.id = card.program_id
where customer.full_name = 'Cliente Multitarjeta'
limit 1\gset

set role anon;

select app.public_card_terms_are_accepted(:'claim_card_token')::text
  as terms_initially_accepted\gset
select case when :'terms_initially_accepted' = 'false' then 1 else 1 / 0 end
  as terms_initially_pending_assertion;

select app.accept_public_card_terms(:'claim_card_token', :'claim_program_version') as acceptance_result\gset
select case when :'acceptance_result' = 'ACCEPTED' then 1 else 1 / 0 end
  as terms_acceptance_result_assertion;

select app.public_card_terms_are_accepted(:'claim_card_token')::text
  as terms_now_accepted\gset
select case when :'terms_now_accepted' = 'true' then 1 else 1 / 0 end
  as terms_accepted_assertion;

select app.accept_public_card_terms('invalid-token', 1) as invalid_acceptance_result\gset
select case when :'invalid_acceptance_result' = 'UNAVAILABLE' then 1 else 1 / 0 end
  as invalid_token_assertion;

do $$
begin
  begin
    perform 1 from public.customer_card_terms_acceptances;
    raise exception 'Anonymous role queried terms acceptance storage directly';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select count(*) as public_claim_count
from app.get_public_card_claim(:'claim_card_token')
where customer_name = 'Cliente Multitarjeta'
  and program_version = :'claim_program_version'::integer
  and length(btrim(terms_and_conditions)) >= 10\gset

select case when :'public_claim_count' = '1' then 1 else 1 / 0 end
  as public_claim_projection_assertion;

reset role;

select count(*) as valid_acceptance_count
from public.customer_card_terms_acceptances acceptance
join public.customer_cards issued on issued.id = acceptance.customer_card_id
join public.loyalty_cards card on card.id = issued.loyalty_card_id
join public.loyalty_programs program on program.id = card.program_id
where acceptance.customer_card_id = :'claim_customer_card_id'::uuid
  and acceptance.program_id = program.id
  and acceptance.program_version = program.version
  and length(btrim(acceptance.terms_snapshot)) >= 10\gset

select case when :'valid_acceptance_count' = '1' then 1 else 1 / 0 end
  as terms_snapshot_assertion;

select 'Customer card terms acceptance assertions passed' as result;
