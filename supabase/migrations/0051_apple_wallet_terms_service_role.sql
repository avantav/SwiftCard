-- Apple Wallet pass issuance uses the server-only service role after loading
-- the possession-based public card. Keep the terms check available to that
-- role as well as to the anonymous claim flow granted in migration 0046.

grant execute on function app.public_card_terms_are_accepted(text) to service_role;
