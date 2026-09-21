# Next Session

## Reviews product context

- `docs/reviews_plan.md` was reviewed on 2026-09-17 and is now an authorized
  post-MVP Phase 11, not the current implementation unit.
- Reviews must operate independently from Loyalty while reusing existing
  tenants, branches, staff and commercial entitlement authority. Do not create
  parallel `businesses` or subscription sources.
- The first implementation unit is a versioned domain/event contract followed
  by separate `LOYALTY`/`REVIEWS` entitlements and RLS coverage. Preserve the
  current Phase 10 next step until priorities are explicitly changed.
- Anonymous visits remain anonymous; only consented, sufficiently identified
  contacts may link to the shared tenant customer without duplication.
- Consumer offers/coupons are separate from Phase 10 billing promotions and
  can never depend on posting, changing, deleting or positively rating a Google
  review.
- Treat QR/NFC metrics as token-attributed landing opens and Google actions as
  outbound clicks. Do not claim a physical scan or a published review without
  evidence.
- Google Business Profile OAuth, rating/review synchronization and cross-product
  Loyalty automation are later units. See `docs/PRODUCT.md` section 31,
  `docs/IMPLEMENTATION_PLAN.md` Phase 11 and `docs/reviews_plan.md` section 38.

## Wallet image-layout context

- Migration `0062_wallet_image_layout_controls.sql` adds per-card scale and
  horizontal/vertical margin values for the logo and main image plus the
  Admin-only `save_loyalty_card_design_v3` RPC.
- `/admin/cards/[cardId]/edit?step=2` previews these values immediately. Apple
  pass generation applies them to every 1x/2x/3x logo and strip; Google Wallet
  receives the shared original assets and retains provider-controlled cropping.
- Defaults preserve the prior rendering: 100% size and 0% margins. Existing
  cards therefore do not change until an Admin edits the controls.
- The product owner confirmed `main` is current and migration `0062` is applied
  remotely. Process the Apple outbox or reinstall a pass for device validation.

## Commercial billing context

- Phase 10 is now explicitly authorized post-MVP and specified in `docs/PRODUCT.md` section 30 plus `docs/BILLING_STRIPE.md`.
- Migration `0059_commercial_billing_foundation.sql` creates the provider-neutral package/subscription/promotion/affiliate model, optional Stripe links, immutable snapshots, forced RLS and backend-derived membership current/peak usage.
- `/superadmin/billing/packages` lets the active Superadmin create a draft package and price atomically, then activate or archive both. There is no hard delete and no Stripe call yet.
- Migration `0060_billing_promotion_management.sql` and
  `/superadmin/billing/promotions` add atomic promotion/rule creation, package
  eligibility and activation/archival. Activation requires a non-expired promo
  with an active eligible package; redemption reservation is still pending.
- Migration `0061_billing_affiliate_management.sql` and
  `/superadmin/billing/affiliates` add RPC-only affiliate creation, activation
  and archival with validated percentage/fixed commissions, normalized contact
  email and attribution window. Attribution and commission accrual remain pending.
- `/admin/billing` is read-only and visible only to the general Admin. It shows
  the subscription snapshot, current/peak memberships, branch/card limits,
  latest promotion and affiliate attribution, with informational capacity
  warnings at 80%, 90% and 100%. It does not enforce limits or initiate billing.
- Billable membership means an active `customer_cards` row whose customer is active. Each period keeps current usage and a high-water mark; `0059` measures only and does not block registrations.
- The complete disposable PostgreSQL migration/RLS harness passes through `0061`, including cross-tenant, Manager and browser-role denial, high-water behavior and RPC-only promotion/affiliate operations.
- Next implementation unit: transactional promotion reservation/cap consumption, followed by affiliate attribution.
- Migrations `0059`–`0061` are applied remotely. Do not add live Stripe
  credentials or public pricing until the remaining commercial policies are
  approved.

## Public landing context

- `/` is now a buyer-facing educational landing rather than an internal gateway. It preserves authenticated staff redirects and the secondary `/login` path.
- The only primary conversion is “Solicitar una demo”; the page intentionally contains no prices, checkout, Stripe integration or payment collection.
- Set `NEXT_PUBLIC_DEMO_REQUEST_URL` to the approved scheduling, WhatsApp, email or form destination before publication. Without it, all demo actions land on a transparent in-page placeholder and no personal data is collected.
- The landing follows `docs/design/design-system(1)`: editorial warm-white composition, navy/teal product previews, Inter with restrained Georgia emphasis, large benefit surfaces, a phone Wallet section and slow layered motion. Below-fold sections reveal once through `IntersectionObserver`; reduced-motion users receive the complete static page immediately.
- The visible brand is lowercase morrow with the rounded navy `m` monogram across marketing, authenticated navigation, PWA, offline, exports and Wallet attribution. Do not rename stable SwiftWallet environment variables, cookies, provider IDs or database namespaces without a separate migration plan.
- Final responsive review and validation for the reference-driven rebrand must be recorded after completion.

1. New primary Admin flow: `/admin/cards` supports up to three non-archived card configurations per tenant. `/admin/program` and `/admin/wallet` redirect there.
2. Aggregate: every `loyalty_cards` row owns one program, one neutral design and branch assignments. Existing program/design/issued-card data is backfilled into one published card by `0043`.
3. Drafts: creation persists immediately; program, design and locations save independently; only a complete draft with at least one branch can publish.
4. Lifecycle: migration `0052` consolidates existing same-name drafts by retaining the most advanced, prevents future duplicates and adds audited Admin-only discard/deactivate/reactivate operations. Permanent card/customer deletion is allowed only when no operational history would be lost; Administradores de sucursal cannot call these RPCs.
5. Operations: `0044` adds card-scoped public/employee registration, scan projection, purchase preview/confirmation, adjustments, Web Card and Apple Wallet availability. The frontend now carries `customerCardId`, never a selectable program or tenant.
6. Customer invariant: this MVP still permits one issued card per customer and tenant. Multiple card configurations are alternatives selected at registration, not simultaneous cards for the same phone.
7. Employee operations: the bottom navigation now has exactly `Registro`, `Clientes` and `Programa`. Scan and search both open one mobile-first, three-step customer modal: overview, minimal purchase/reward input and explicit confirmation. Search keeps its form visible and labels long result sets with count, phone and card. `/app/program` shows earning rules, reward tiers and terms.
8. Employee identity: the shared header now displays the authenticated tenant logo/name instead of SwiftWallet plus account metadata. Operator name appears only for shared-PIN attribution; normal online status is silent, while offline blocking and relevant install help remain actionable.
9. Customer handoff: employee registration returns to `/app`, shows an immediately rendered QR to the possession-based claim URL, and lets the customer review and accept current terms before adding Apple Wallet or opening Web Card on one compact screen. The tenant Admin can regenerate that same claim QR on demand from each active card in `/admin/customers`. Migration `0046` stores a versioned immutable terms snapshot and gates initial Apple issuance.
10. Repeat delivery: migration `0047` reports whether Apple has an active device registration for the authorized issued card. The customer modal shows a collapsed QR generator only while that registration is absent, and reuses the same claim/terms screen.
11. Apple design repair: migration `0048` queues installed passes when their card-owned design/status or branch assignments change. Program, design and location actions immediately attempt APNs delivery. The Apple preview uses the saved goal, configured unit names, effective card/tenant assets, signed-pass stamp-slot logic and actual `storeCard` field hierarchy. Unsaved text/colors and newly selected logo/strip files now update the preview immediately through local object URLs; saving is blocked while an upload is active. Current Apple documentation warns that iOS 26+ may omit logo/strip images.
12. Lifetime points: migration `0049` enables the third program type in the card wizard. Purchases calculate internal tenths, truncate every purchase without carry, never reset the balance and award each reached milestone once. Customer/employee projections show integers; Admin metrics and purchase exports preserve one decimal.
13. Point-card design: Web Card, Apple pass payload and Apple/Android Admin previews show a large accumulated balance, progress to the next milestone and a completion message instead of stamp circles. Lifetime purchases/reward cancellations and manual point adjustments are database-blocked.
14. Branch geofencing: migration `0050` adds an Admin-only audited strict/flexible control, refuses strict mode while an active branch lacks coordinates, hardens branch/tenant/status distance checks and prevents coordinate-less active branches once strict mode is enabled.
15. Location UX: branch create/edit uses Google Places Autocomplete (New), a clickable map, current-position assistance and a visual radius circle. Purchase/reward confirmation captures normalized browser GPS in the primary scanner modal and both compatibility routes; strict mode blocks until location is available and the database remains authoritative.
16. Apple terms repair: migration `0051` grants `service_role` execution of `app.public_card_terms_are_accepted`, matching the Admin client used by initial pass issuance. The targeted grant is already applied to hosted Supabase and a live check of the latest accepted card succeeds. Deploy the route change so future database errors return a verification error instead of the incorrect “debes aceptar” message.
17. Casa Garmendia import: migration `0053` gives only that tenant's active general Admin a fixed, single-use profile. It auto-maps Nombre/Apellido/Email/Teléfono/Fecha de Nacimiento/Estampillas Actuales, converts 0–15 legacy stamps by the supplied milestone table, grants Churro individual plus reached configured tiers, and records the import identifier atomically.
18. Imported recovery: an exact imported phone/name on the same public card resumes the existing claim instead of creating a duplicate. Employee search may always regenerate the claim QR for these imported cards, and both routes require current terms before Wallet delivery.
19. Migration rollout: the product owner confirmed `main` is current and every
    migration through `0062` is applied remotely.
20. Immediate release step: process the Apple outbox; afterward obtain the real
    workbook, verify the target card has active tiers
    100/200/300/400/500/650/860, preview all errors and only then confirm the
    one-time import.
21. Local validation completed: lint, typecheck, all 245 Vitest tests in 71 files, the webpack production build and the previously completed disposable PostgreSQL migration/RLS suite through `0058` pass. Google Wallet public actions passed responsive review at 375, 768, 1280 and 1440 px; the Apple notification-logo editor passed at 375 and 1440 px, and the broader Apple preview was previously reviewed at all four widths.
22. Shared PIN unlock: `/app/unlock` now uses a six-digit keypad with clear/backspace and physical-keyboard support. The server action returns success only after writing the HttpOnly operator cookie; the client then performs a full replacement navigation to `/app`, avoiding reuse of the locked layout context. Failed attempts clear the entered PIN and keep existing database lockout behavior.
23. Welcome gift: targeted migration `0054` is now live in hosted production and the 16-parameter save path returned `SAVED` in an authenticated rollback test. Casa Garmendia remains intentionally disabled with no test data; retry the Admin form using the intended name/description/validity, then issue a new test customer card and verify exactly one reward. The behavior is non-retroactive, does not alter points and excludes the `0053` Casa import profile because it already grants its fixed Churro.
24. Google Wallet issuance is implemented without a new migration. Configure `GOOGLE_WALLET_ISSUER_ID`, the raw/Base64 service-account JSON and the canonical HTTPS origin; enable the API, add the service account as a Wallet Console Developer, obtain publishing access and validate a real Android save. The Admin Android toggle now previews the loyalty-pass adapter; exact rendering remains controlled by Google.
25. Public QR registration: all focusable text/date controls render at 16px, preventing iOS automatic focus zoom without setting `user-scalable=no` or blocking the customer's manual pinch zoom. The composition was reviewed at 375, 768, 1280 and 1440 px.
26. Apple header/QR layout: signed passes use a tight aspect-ratio logo canvas, reserve the top row for left-aligned logo plus tenant name, move available-reward count to the back and omit the text under the QR. Migration `0055` queues installed passes once and must be applied only after the new application code is deployed, then the protected outbox processor must run.
27. Casa Garmendia point repair: the hosted PROD program now stores `amount_per_stamp_minor = 1000` (MXN $10 per point) and version 5. Migration `0056` corrected the only affected MXN $2,000 purchase, ledger and balance from 2,000 to 200 points, retained the 100/200 rewards, cancelled 300/400/500/650/860, marked the 400 redemption `REVERSED`, wrote a dedicated audit event and queued an Apple update. Do not repeat this manually; `0056` is exact and idempotent, and other environments no-op because the production tenant UUID is absent.
28. Apple front progress repair: deploy the generator before applying `0057`, then process the outbox. Casa Garmendia should show `PREMIOS 2`, `■■■□□ 200/300` and the compact next reward below the 200-point balance while the full logo/name remains alone in the header. The generated `strip.png` adds a smooth bar on pre-iOS-26 devices; the five-block field is mandatory because Apple documents that store-card strip images are not rendered on iOS 26+.
29. Apple notification logo: migration `0058` must be applied before deploying the editor code that selects `notification_icon_url` and calls `save_loyalty_card_design_v2`. The Admin can then upload a square icon in card stage 2; saving queues that card's installed passes, and the generator uses the normal logo whenever the dedicated icon is empty or invalid. Google Wallet uses the shared general logo/hero assets and intentionally does not consume Apple's notification-only icon.

## Prior lifetime-points context

1. Branch: `codex/swiftwallet-mvp`.
2. Latest feature: additive migration `0049` and `/admin/cards` make `LIFETIME_POINTS` publishable and operational with point-specific card layouts.
3. Compatibility: every existing program is backfilled to `STAMPS_PER_PURCHASE` or `STAMPS_PER_AMOUNT`; its current cyclic calculation remains unchanged.
4. Safety boundary: lifetime purchases, manual reward cancellations and point adjustments are disabled by database policy; the existing cyclic paths continue unchanged.
5. Type transition: an existing program can change type after explicit confirmation and preserves rewards plus historical purchase rule/version snapshots. Entering lifetime points converts current stamp balances with the configured multiplier, clears old monetary remainder, writes one `PROGRAM_CHANGE` ledger entry per affected customer and audits the conversion. A published card remains active after a successful save; `0042` repairs older transitions made during the prior rollout.
6. Reward catalog: the prior 10-level application/database cap was removed; per-tier values and text remain bounded.
7. Implemented lifetime behavior: one point per configurable integer amount, internal tenths, per-purchase truncation, no discarded-fraction carry, no reset, each milestone once and continued accumulation after the final milestone.
8. Implemented visibility: customers and employees see integer units; Admin metrics and purchase exports show one decimal. Web Card and Apple Wallet show current points, progress to the next milestone and a completion message.
9. Welcome: one configurable reward granted once when a future customer card is issued by self-service or an employee; a fixed program option decides whether generic imports also receive it. It does not deduct points or reset progress, and registration remains available while the program is paused.
10. Imports: `1 imported stamp = N points` uses an integer multiplier; confirmation awards every reached milestone and does not accept historical reward status.
11. Policies: lifetime purchase cancellation, manual reward cancellation and point adjustments are disabled. Remaining generic configurable reversal/correction interfaces are still pending.
12. Operational flow: scanner or manual customer selection must open one customer view with available rewards plus register-purchase action; each redemption remains one reward per operation.
13. Validation: lint, typecheck, all 211 Vitest tests, webpack production build and disposable PostgreSQL/RLS through `0049` pass. Point-card compositions were reviewed at 375, 768, 1280 and 1440 px without overflow; temporary review code was removed.
14. PWA viewport: `/app` fixes the viewport at scale 1, disables user scaling, rejects pinch/double-tap zoom gestures and keeps all form controls at 16px. This is intentionally scoped away from `/admin`.
15. Next exact rollout validation: process the queued Apple refresh, then run
    the hosted points, welcome-gift and Casa import preview smoke paths.
16. Apple preview: the Admin mock now follows the official field hierarchy and `375 × 144 pt` strip proportion, and the real pass generator emits matching 1x/2x/3x strips. Exact OS rendering still requires Pass Designer or a real signed pass.
17. Separate existing rollout: Apple QR/scanner deployment, real iPhone APNs validation, external retry cron and Google Wallet remain pending.
18. Migration state: do not edit deployed migrations. Apply additive migrations in order through `0049_lifetime_points_engine.sql`.
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
