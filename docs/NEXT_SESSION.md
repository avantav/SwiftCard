# Next Session

1. New primary Admin flow: `/admin/cards` supports up to three non-archived card configurations per tenant. `/admin/program` and `/admin/wallet` redirect there.
2. Aggregate: every `loyalty_cards` row owns one program, one neutral design and branch assignments. Existing program/design/issued-card data is backfilled into one published card by `0043`.
3. Drafts: creation persists immediately; program, design and locations save independently; only a complete draft with at least one branch can publish.
4. Operations: `0044` adds card-scoped public/employee registration, scan projection, purchase preview/confirmation, adjustments, Web Card and Apple Wallet availability. The frontend now carries `customerCardId`, never a selectable program or tenant.
5. Customer invariant: this MVP still permits one issued card per customer and tenant. Multiple card configurations are alternatives selected at registration, not simultaneous cards for the same phone.
6. Employee operations: the bottom navigation now has exactly `Registro`, `Clientes` and `Programa`. Scan and search both open one mobile-first, three-step customer modal: overview, minimal purchase/reward input and explicit confirmation. Search keeps its form visible and labels long result sets with count, phone and card. `/app/program` shows earning rules, reward tiers and terms.
7. Employee identity: the shared header now displays the authenticated tenant logo/name instead of SwiftWallet plus account metadata. Operator name appears only for shared-PIN attribution; normal online status is silent, while offline blocking and relevant install help remain actionable.
8. Customer handoff: employee registration returns to `/app`, shows an immediately rendered QR to the possession-based claim URL, and lets the customer review and accept current terms before adding Apple Wallet or opening Web Card on one compact screen. Migration `0046` stores a versioned immutable terms snapshot and gates initial Apple issuance.
9. Repeat delivery: migration `0047` reports whether Apple has an active device registration for the authorized issued card. The customer modal shows a collapsed QR generator only while that registration is absent, and reuses the same claim/terms screen.
10. Apple design repair: migration `0048` queues installed passes when their card-owned design/status or branch assignments change. Program, design and location actions immediately attempt APNs delivery. The Apple preview uses the saved goal, configured unit names, effective card/tenant assets, signed-pass stamp-slot logic and actual `storeCard` field hierarchy. Unsaved text/colors and newly selected logo/strip files now update the preview immediately through local object URLs; saving is blocked while an upload is active. Current Apple documentation warns that iOS 26+ may omit logo/strip images.
11. Immediate release step: apply validated migrations `0043` through `0048` to hosted Supabase with approval, then smoke-test draft/resume/publish/register/handoff/accept/add-card/edit-design/edit-program/edit-locations/automatic-refresh/scan/search/customer-modal/redeem/purchase.
12. Local validation completed: typecheck, lint, 208 Vitest tests, webpack production build and the complete disposable PostgreSQL migration/RLS suite through `0048` pass. The repaired design editor was reviewed at 375, 768, 1280 and 1440 px without overflow; an interactive browser check confirmed immediate brand, description, color and blob-logo rendering plus upload-time submission blocking. Its temporary route was removed.
13. Google Wallet generation remains pending. The Admin Android toggle is explicitly labeled as a conceptual preview, not a claim that Google pass issuance is implemented.

## Prior lifetime-points context

1. Branch: `codex/swiftwallet-mvp`.
2. Latest feature: migrations `0041`/`0042` and `/admin/program` let the Admin general change among the three explicit program types with confirmation, audit, current stamp-balance conversion and a mandatory paused transition.
3. Compatibility: every existing program is backfilled to `STAMPS_PER_PURCHASE` or `STAMPS_PER_AMOUNT`; its current cyclic calculation remains unchanged.
4. Safety boundary: `LIFETIME_POINTS` can be configured but is forced to `PAUSED` in both form validation and the database RPC until its decimal/non-resetting engine is implemented.
5. Type transition: an existing program can change type after activity. The save starts paused and preserves rewards plus historical purchase rule/version snapshots. Entering lifetime points converts current stamp balances with the configured multiplier, clears old monetary remainder, writes one `PROGRAM_CHANGE` ledger entry per affected customer and audits both the type change and conversion. `0042` repairs the conversion if the switch happened after `0041` went online.
6. Reward catalog: the prior 10-level application/database cap was removed; per-tier values and text remain bounded.
7. Confirmed lifetime behavior to implement: one point per configurable integer amount, internal tenths, truncate every purchase, no carry of discarded fractions, no reset, each milestone once, points continue after the final milestone.
8. Visibility: customers and employees see integer units; Admin and exports see one decimal. Web Card and Apple Wallet show current points, progress to the next milestone and a completion message; Apple shows as many next rewards as its bounded layout safely permits.
9. Welcome: one configurable reward granted once at self-service registration; a fixed program option decides whether imports also receive it. Registration remains available while the program is paused.
10. Imports: `1 imported stamp = N points` uses an integer multiplier; confirmation awards every reached milestone and does not accept historical reward status.
11. Policies: purchase cancellation, manual reward cancellation and redemption reversal are configurable. Garmendia starts with the first two disabled and reversal enabled for Admin plus assigned Branch Administrator. Manual lifetime-point adjustments remain disabled.
12. Operational flow: scanner or manual customer selection must open one customer view with available rewards plus register-purchase action; each redemption remains one reward per operation.
13. Validation: lint, typecheck, all 189 Vitest tests, webpack production build and disposable PostgreSQL/RLS through `0042` pass. The conversion confirmation state was reviewed at 375, 768, 1280 and 1440 px without overflow; its temporary review route was removed.
14. PWA viewport: `/app` fixes the viewport at scale 1, disables user scaling, rejects pinch/double-tap zoom gestures and keeps all form controls at 16px. This is intentionally scoped away from `/admin`.
15. Next exact implementation: add tenths-based lifetime balances and purchase/milestone SQL with cancellation-safe invariants, then welcome/import generation and card/Wallet projections. Only after those pass should the new type be allowed to become ACTIVE.
16. Apple preview: the Admin mock now follows the official field hierarchy and `375 × 144 pt` strip proportion, and the real pass generator emits matching 1x/2x/3x strips. Exact OS rendering still requires Pass Designer or a real signed pass.
17. Separate existing rollout: Apple QR/scanner deployment, real iPhone APNs validation, external retry cron and Google Wallet remain pending.
18. Migration state: the user confirmed `0040` and `0041` are online. Do not edit either migration; apply only additive `0042_stamp_to_point_balance_conversion.sql` for the balance conversion.
19. Web Card progress: cyclic programs now use up to 24 graphical stamp circles, five per row; earned circles show the tenant logo or initials, while assistive technology retains the exact numeric count. Apple Wallet keeps its provider-controlled field layout.
20. Apple graphical progress: the signed pass now generates its own customer-specific strip at 1x/2x/3x from the current backend balance and repeats the tenant logo in earned circles. Each APNs refresh returns a complete newly signed pass with a new image. The exact auxiliary progress remains because current Apple documentation indicates that Wallet may omit strip images on some OS/device combinations; real-device validation is still required.

## Previous Apple Wallet Context

1. Admin general can edit branch identity, address, coordinates, geofence, proximity message/activation and status inline from `/admin/branches`; access mode remains separate.
3. Branch editing authority: the server validates the branch UUID and every editable field, derives the tenant from the authenticated Admin context, matches both branch and tenant under existing RLS, confirms deactivation, and never accepts a frontend `tenant_id`.
4. Branch editing rollout: no migration is required. Existing Apple Wallet branch triggers queue changed name, status, location and proximity data, and the action attempts immediate best-effort dispatch.
5. QR authority: only the existing `customer_cards.public_token` or its `/card/{token}` URL is encoded; the backend tenant-scoped scan RPC remains authoritative and no name, phone, UUID or balance enters the QR.
6. Current Wallet state: migration `0039` was applied manually and the user confirmed initial pass generation works again. The barcode/location persistence correction is local and awaits deployment plus real-device validation.
7. Scanner state: `@zxing/browser@0.1.5` with Node-compatible `@zxing/library@0.21.3` is route-scoped to the client scanner. Camera permission is explicit, environment-facing is preferred, and permission/device failures direct the employee to the integrated name/phone search modal. The modal reopens after search/edit responses, traps interaction through native dialog behavior and scrolls internally; manual token/URL entry and `/app/customers` remain removed.
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
