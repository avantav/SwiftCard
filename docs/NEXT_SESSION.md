# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Latest feature: migration `0040` and `/admin/program` now persist and display three explicit program types plus custom unit labels, welcome/import options and operational policies.
3. Compatibility: every existing program is backfilled to `STAMPS_PER_PURCHASE` or `STAMPS_PER_AMOUNT`; its current cyclic calculation remains unchanged.
4. Safety boundary: `LIFETIME_POINTS` can be configured but is forced to `PAUSED` in both form validation and the database RPC until its decimal/non-resetting engine is implemented.
5. Type locking: after any purchase, reward or nonzero balance/remainder exists, changing the program type returns `TYPE_LOCKED`.
6. Reward catalog: the prior 10-level application/database cap was removed; per-tier values and text remain bounded.
7. Confirmed lifetime behavior to implement: one point per configurable integer amount, internal tenths, truncate every purchase, no carry of discarded fractions, no reset, each milestone once, points continue after the final milestone.
8. Visibility: customers and employees see integer units; Admin and exports see one decimal. Web Card and Apple Wallet show current points, progress to the next milestone and a completion message; Apple shows as many next rewards as its bounded layout safely permits.
9. Welcome: one configurable reward granted once at self-service registration; a fixed program option decides whether imports also receive it. Registration remains available while the program is paused.
10. Imports: `1 imported stamp = N points` uses an integer multiplier; confirmation awards every reached milestone and does not accept historical reward status.
11. Policies: purchase cancellation, manual reward cancellation and redemption reversal are configurable. Garmendia starts with the first two disabled and reversal enabled for Admin plus assigned Branch Administrator. Manual lifetime-point adjustments remain disabled.
12. Operational flow: scanner or manual customer selection must open one customer view with available rewards plus register-purchase action; each redemption remains one reward per operation.
13. Validation: lint, typecheck, 184 Vitest tests, webpack build and disposable PostgreSQL/RLS through `0040` pass. The configuration UI was reviewed at 375, 768, 1280 and 1440 px; the temporary review route was removed.
14. Next exact implementation: add tenths-based lifetime balances and purchase/milestone SQL with cancellation-safe invariants, then welcome/import generation and card/Wallet projections. Only after those pass should the new type be allowed to become ACTIVE.
15. Separate existing rollout: Apple QR/scanner deployment, real iPhone APNs validation, external retry cron and Google Wallet remain pending.

## Previous Apple Wallet Context

1. Admin general can edit branch identity, address, coordinates, geofence, proximity message/activation and status inline from `/admin/branches`; access mode remains separate.
3. Branch editing authority: the server validates the branch UUID and every editable field, derives the tenant from the authenticated Admin context, matches both branch and tenant under existing RLS, confirms deactivation, and never accepts a frontend `tenant_id`.
4. Branch editing rollout: no migration is required. Existing Apple Wallet branch triggers queue changed name, status, location and proximity data, and the action attempts immediate best-effort dispatch.
5. QR authority: only the existing `customer_cards.public_token` or its `/card/{token}` URL is encoded; the backend tenant-scoped scan RPC remains authoritative and no name, phone, UUID or balance enters the QR.
6. Current Wallet state: migration `0039` was applied manually and the user confirmed initial pass generation works again. The barcode/location persistence correction is local and awaits deployment plus real-device validation.
7. Scanner state: `@zxing/browser@0.1.5` with Node-compatible `@zxing/library@0.21.3` is route-scoped to the client scanner. Camera permission is explicit, environment-facing is preferred, and permission/device/offline failures retain manual input.
8. New pass metadata: every newly generated pass contains `webServiceURL`, stable per-pass `authenticationToken`, the existing serial and current `changeMessage` fields.
9. Public update base: `${SWIFTWALLET_PUBLIC_URL}/api/wallet/apple`; official `/v1` register, unregister, changed-serial, updated-pass and log endpoints are implemented.
10. Database security: device identifiers are keyed hashes, push tokens are AES-256-GCM ciphertext, update tables have forced RLS and no browser grants, and worker RPCs are `service_role` only.
11. Update authority: migration triggers queue changes to balances, rewards, customer/card state, program, reward tiers, Wallet design, branding and branch locations inside the same transaction.
12. Delivery mode: successful purchase, redemption, customer, program, design, branch and tenant actions attempt APNs immediately; failure never reverts the application operation and remains in the outbox.
13. APNs: production HTTP/2 endpoint, empty JSON payload, background push type, Pass Type topic, and the existing signer certificate/private key plus WWDR chain.
14. Invalid APNs device tokens remove their registrations. Successful device deliveries advance their update tag and avoid duplicate retry pushes.
15. Future retry path: `POST /api/internal/wallet/apple/process-updates` requires `Authorization: Bearer <APPLE_WALLET_RETRY_SECRET>` and processes up to 25 jobs. Connecting an external cron remains explicitly pending because Hostinger shared cron is not confirmed.
16. Required new secret: `APPLE_WALLET_UPDATE_SECRET_BASE64`, exactly 32 random bytes encoded as Base64. It is stable and must not be rotated directly.
17. Optional future scheduler secret: `APPLE_WALLET_RETRY_SECRET`, at least 32 random characters.
18. Existing Apple and Supabase secret names remain in `.env.example`; no secret is committed.
19. Important rollout: existing passes may lack update metadata or the corrected visible barcode; refresh through PassKit after deployment or remove and reinstall before scanning.
20. Validation completed: branch editing passed focused validation and responsive review; the latest full-suite counts are recorded in `docs/PROJECT_STATUS.md`.
21. Deployment guide: `docs/APPLE_WALLET_UPDATES.md`.
22. No new database migration is required for branch editing or the QR/scanner correction.
23. After deployment: edit a branch and confirm its saved data, then open `/app/scan`, grant camera permission, scan the visible Apple Wallet QR, verify the correct customer, register a stamp and verify APNs returns an updated `.pkpass`.
24. Remaining Phase 8 work: external retry cron, production APNs validation and Google Wallet.
