# Public camera QR and customer privacy

## Behavior

New Web Card, Apple Wallet and Google Wallet QR codes contain an HTTPS
`/scan/q1_...` link. The payload is authenticated AES-256-GCM ciphertext with a
fresh 12-byte nonce, a 16-byte authentication tag and purpose-specific additional
data. The private possession token cannot be read from the QR or its URL.

A normal camera opens a server-only route. The route verifies the token and
looks up only the originating branch and published card. It returns a 303 to
`/register/{branchToken}?card={publishedCardId}`. The selected card must still
participate in that active branch and tenant. Invalid, inactive, revoked or
cross-tenant targets return the same generic 404. Responses use `no-store`,
`no-referrer` and `noindex`; no customer record, name, phone, customer UUID,
private possession token or database error is serialized into the response.

Inside the employee app, session/role/PIN checks run before unsealing the token.
The existing authenticated `resolve_staff_card_scan` RPC retains tenant and
operator authority. Legacy card URLs and raw tokens remain accepted by the
staff scanner during rollout.

## Public registration sessions

`register_public_customer` is deliberately executable by `anon`, not by
`authenticated`. Public enrollment now uses a stateless server-side anonymous
client with no staff cookies, session persistence or PIN headers. This fixes
registration failures when an Administrator tests a QR in the same browser as
their authenticated panel. Database privileges and RLS are not broadened.

## Keys and rollout

- No migration is required.
- `CARD_SCAN_SECRET_BASE64` optionally supplies a stable 32-byte server-only key.
  Without it, the server derives a purpose-specific SHA-256 key from its current
  Supabase server credential. No secret is sent to the browser.
- Choose a dedicated stable key before issuing new QR codes when Supabase
  credential rotation must be independent. Changing the effective key after
  issuance invalidates existing sealed codes and requires a planned rollout.
- Deploy the route and generators together. Existing installed/printed QR codes
  cannot change merely from a Git push: Apple passes need an update/reinstall;
  Google objects need resynchronization through the existing add action.
- The separate private card/claim link is still a possession-based customer
  capability. It is intentionally excluded from the printed/scannable QR;
  it must not be published as an anonymous customer-directory API.

## Validation

Tests cover encrypted round trips, nonce uniqueness, tampering, key changes,
invalid input, public redirect headers/body, tenant and branch isolation,
revocation, status checks and authentication before staff token resolution.
A browser smoke test decodes the actual issued PNG, follows its URL in a fresh
session and verifies the destination and absence of customer data and direct
browser-to-Supabase requests. Production device refresh remains a release check.
