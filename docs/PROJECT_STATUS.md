# Project Status

## Current State

- Current phase: Phase 10 commercial foundation, with landing and Wallet rollout validation still pending in parallel.
- Current task: Add transactional promotion reservation and cap consumption before Checkout.
- Last completed task: Added an explicit per-card option to show or hide the
  graphical stamp circles over Apple Wallet's main image while retaining the
  exact textual progress field.
- Current branch: `codex/google-wallet`.
- Last stable feature: Tenant Admins can independently control Apple main-image
  dimming and graphical stamp visibility while preserving provider dimensions,
  textual progress and the original defaults for existing cards.
- Git status: The stamp-visibility option passes lint, typecheck, all 285 tests
  across 78 files, webpack build and disposable PostgreSQL migration/RLS
  verification through `0064`. The product owner confirmed migrations through
  `0062` are applied remotely; `0063` and `0064` remain to be applied remotely.
- Remote backup: `main` contains the Wallet image-layout work and hosted
  migrations are current through `0062`. The Casa Garmendia welcome
  configuration intentionally remains disabled until the Admin retries the form
  with the intended gift.

## Completed Functionality

- The root route follows the supplied morrow reference: warm editorial canvas, large Inter/Georgia hierarchy, navy/teal palette, product dashboard, floating loyalty card, phone Wallet experience, spacious benefit cards and one repeated “Solicitar una demo” conversion goal. It contains no pricing, checkout or payment collection.
- The visible product identity is now lowercase morrow with its navy rounded-square italic `m` monogram. Public/authenticated navigation, metadata, install surfaces, offline UI, exports and non-white-label Wallet attribution use the new brand; stable SwiftWallet technical identifiers remain unchanged for compatibility.
- Landing product layers float at slow independent rhythms and below-fold content reveals once on entry; `prefers-reduced-motion` removes ambient motion and leaves the complete experience readable.
- Active staff still leave the landing automatically for their authorized area, password-reset-required users retain their security redirect and unauthenticated staff can reach `/login` through a secondary action.
- Phase 10 is explicitly authorized post-MVP. Migration `0059` adds forced-RLS package, price, billing customer, subscription, membership usage, promotion, redemption, affiliate, referral, commission and Stripe-event tables.
- A billable membership is an active issued customer card for an active customer. Database triggers maintain the current count and period high-water mark; deactivation can lower current usage but never its historical peak.
- Superadmin can create an atomic package plus monthly/yearly price as a draft, activate both together or archive both without deleting subscription history from `/superadmin/billing/packages`.
- Superadmin can create percentage or fixed-amount promotions with dates,
  duration, package eligibility, global/per-tenant caps and membership coverage
  from `/superadmin/billing/promotions`. Creation is atomic; activation requires
  an active eligible package and a non-expired promotion.
- Superadmin can create, activate and archive affiliates with percentage or
  minor-unit fixed commissions, optional normalized contact email and a 1–365
  day attribution window from `/superadmin/billing/affiliates`. Direct catalog
  writes are revoked so application changes must pass through audited RPCs.
- The general Admin can inspect its own package, recurring price, subscription
  state/period, current and peak membership use, branch/card limits, latest
  promotion and affiliate attribution from `/admin/billing`. Capacity warnings
  appear at 80%, 90% and 100%; they are informational and do not block issuance.
- Tenant Admins can read only active public catalog entries and their own tenant's commercial records; Managers and Employees cannot read billing data, and browser roles have no access to Stripe event records or usage-authority functions.
- Product source normalized into `docs/PRODUCT.md`.
- Persistent repo instructions added in `AGENTS.md`.
- Executable implementation plan started.
- Next.js 16 App Router scaffold.
- Base routes: `/`, `/superadmin`, `/admin`, `/app`, `/register/[branchToken]`, `/card/[cardToken]`.
- Admin-only `/admin/imports` profile for Casa Garmendia with fixed six-column mapping, one-time confirmation and tenant/card/branch-derived database authority.
- Casa Garmendia PROD now uses MXN $10 per lifetime point. Its single erroneous purchase, balance and ledger were corrected to 200 points; only 100/200 rewards remain available, the 400-point canje is preserved as reversed, higher rewards are audited as cancelled and an Apple refresh is queued.
- Imported customer identification enables terms-gated public recovery and repeat employee QR delivery without issuing a second card.
- Health endpoint: `/api/health`.
- Vitest health endpoint test.
- Supabase environment template and config helpers without secrets.
- Initial tenancy/auth migration for tenants, branches, staff profiles, staff branch assignments, helper functions, triggers, grants, and RLS policies.
- Static migration coverage in Vitest.
- TypeScript role/permission helpers for Phase 1 UI/routing decisions.
- Supabase SSR dependency and client factories.
- `/login` page with email/password server action.
- Middleware session refresh and protection for `/superadmin`, `/admin`, and `/app`.
- Open redirect protection for auth redirects.
- Server-only Supabase admin client guarded by `server-only`.
- Minimal `/superadmin/tenants/new` form and server action for tenant creation.
- Same-name card drafts are consolidated and future creation resumes the canonical draft instead of creating another row.
- Admin-only reversible card archival/reactivation and customer deactivation/reactivation, with permanent deletion restricted to records without immutable operational history.
- Tenant creation input validation tests.
- Disposable PostgreSQL RLS harness available through `npm run db:verify-rls`.
- Positive and negative RLS assertions for tenant, branch, status, and role boundaries.
- Superadmin first-Administrator form after tenant creation.
- Server-only Auth user provisioning with profile compensation.
- Atomic first-Administrator profile RPC with concurrent duplicate protection.
- Superadmin password-reset form for the existing tenant Administrator.
- Profile-first password reset RPC that rejects cross-tenant, unauthorized, and inactive targets.
- `/change-password` flow with current-password verification and distinct new password validation.
- Service-role-only profile activation after Auth password update.
- Dynamic server-side role/status/tenant guards for all internal route trees.
- Admin-only `/admin/branches` listing and creation flow.
- Branch validation for coordinates, geofence radius, address, and proximity.
- Branch creation reports all field issues together, restores non-sensitive inputs, focuses an accessible error summary, and translates RLS, schema/migration, constraint, session, Auth-email, and Auth-password failures without leaking secrets.
- Branch IDs are generated on the trusted server before insertion, so creation no longer depends on an RLS-filtered `INSERT ... RETURNING` response to continue shared-account compensation safely.
- Admin general can edit branch name, address, coordinates, geofence radius, proximity activation/message and status inline from `/admin/branches`; validation retains submitted values, deactivation requires confirmation, and the write matches both branch ID and the authenticated tenant under RLS.
- Branch location/proximity/status changes continue through the existing Apple Wallet outbox trigger and immediate best-effort dispatcher; shared-access mode and credentials remain in their separate confirmed control.
- Branch create/edit now uses Google Places Autocomplete (New), an interactive Google map, point adjustment, current-position assistance and a visual radius circle instead of manual coordinate inputs. Existing coordinates remain preserved if Maps configuration is unavailable.
- `/admin/branches` clearly separates Apple Wallet proximity from operational geofencing and lets only the tenant Admin enable or disable strict GPS validation. Activation is refused until every active branch has coordinates and every change is audited.
- Purchase and reward confirmations in the primary scanner modal and compatibility routes capture browser geolocation, send normalized coordinates to the existing authoritative RPCs and show actionable permission, timeout and outside-radius errors. Flexible mode permits submission and can retain optional diagnostic GPS; strict mode requires it.
- Admin-only `/admin/staff` creation for Manager and Employee accounts.
- Server-only Auth provisioning with profile cleanup compensation.
- Tenant and creator derived from the authenticated Admin context.
- Atomic staff-to-branch assignment RPC with primary-branch promotion.
- Admin-only branch assignment controls on `/admin/staff`.
- Tenant-scoped `customers` and `customer_cards` schema with one card per customer.
- Tenant-scoped `loyalty_cards` aggregate with a database-enforced limit of three non-archived cards, exactly one linked program, provider-neutral design, one-or-many branch assignments and durable staged drafts.
- `/admin/cards` replaces the separate Program and Apple Wallet navigation entries, reports per-card emissions/purchases/money/units/rewards and provides four resumable stages: program, design, locations and publication.
- Public and employee registration select only published cards participating in the chosen branch; QR scanning retains the issued card ID and purchase/adjustment authority derives its program and location scope on the backend.
- Web Card and Apple Wallet now resolve colors, logo, reward catalog and proximity locations from the issued card instead of a tenant-wide latest program/design.
- Per-tenant phone uniqueness and random rotatable public card token.
- Anonymous role denied direct access to customer/card tables.
- Shared phone normalization for Mexican and international formats.
- Database constraint requiring normalized E.164 phone values.
- Atomic positive stamp adjustments generate multiple rewards and preserve the stamp remainder.
- Activating a lower reward goal converts qualifying balances into rewards and records a `PROGRAM_CHANGE` ledger boundary.
- Expired rewards are blocked at redemption, swept from staff reward views, and excluded independently from the public Web Card.
- Reward generation, expiration, cancellation reasons, and loyalty program changes produce accurate audit events.
- Admin can create the tenant's first loyalty program and edit, pause, or reactivate it from `/admin/program`.
- Program money inputs use the tenant currency's minor-unit precision and never accept `tenant_id` from the form.
- Initial program creation converts imported/pre-existing stamp balances into rewards atomically when the configured goal is met.
- Admin can configure one or more uniquely ordered reward levels with independent names, descriptions, and expiration rules.
- Admin can now configure an explicit stamps-per-purchase, stamps-per-amount or lifetime-points type, custom singular/plural unit labels, welcome reward and import eligibility, integer stamp-to-point conversion, and correction/reversal policies through migration `0040`.
- The multi-card editor now exposes the optional welcome gift with name, description and optional 1–3650 day validity. Migration `0054` grants it exactly once when a future customer card is issued through public or employee registration, respects generic import eligibility, leaves points untouched and excludes the Casa Garmendia profile because that import already assigns its fixed welcome reward.
- Hosted production now has migration `0054` applied as a targeted repair. PostgREST exposes the 16-parameter card-program save RPC, `rewards.is_welcome_reward` is readable and the one-time issuance trigger is enabled; an authenticated Casa Garmendia save returned `SAVED` in rollback validation.
- Existing programs are backfilled to their current cyclic type; Admin type changes preserve historical data. Entering lifetime points converts each current stamp balance with the configured multiplier, clears obsolete monetary remainder and records a ledger boundary without altering existing rewards. Additive migration `0042` repairs transitions made during the earlier rollout, while `0049` enables decimal purchases, non-resetting balances and one-time milestones. Reward catalogs have no product-level count cap.
- Intermediate rewards accumulate without resetting progress; the highest reward closes the cycle, preserves excess stamps, and can unlock the next cycle's lower levels in the same operation.
- Purchases and adjustments store completed-cycle metadata separately from the number of rewards generated so cancellation restores balances correctly.
- The public Web Card and provider-neutral Wallet payload include program terms and the active prize catalog ordered by required stamps.
- The Admin reward-tier editor visibly confirms additions, collapses prior levels, opens and focuses each new level, keeps edited summaries synchronized, and exposes accessible Editar/Ocultar controls.
- Hosted Supabase PostgreSQL 17 development database was verified with migrations through `0037` applied.
- Application RPC calls explicitly target the exposed `app` schema while public administrative RPCs remain in `public`.
- Repeatable `npm run db:push:remote` migration runner refuses untracked existing SwiftWallet schemas and records canonical Supabase migration history.
- Compensating `npm run db:bootstrap:superadmin` flow creates an Auth user and active Superadmin profile without storing credentials in Git.
- Hosted development project has one confirmed active Superadmin, one active tenant, and one tenant Administrator; authenticated Superadmin routing is working.
- Mandatory enterprise design rules now cover layout, navigation, tokens, components, states, responsive behavior, accessibility, content, implementation, prohibited patterns, and completion review.
- Superadmin now uses a reusable enterprise shell with responsive navigation, active-route indication, account identity, visible logout, operational metrics, semantic tenant table, status actions, and explicit loading-result/error/empty/success treatments.
- Tenant creation, Administrator setup, branding, import upload, and import mapping routes now retain the same enterprise hierarchy and pending-submit behavior.
- Administrator now uses the shared dark enterprise sidebar, role-aware navigation, overview, operational lists, responsive dashboard table, consistent filters, forms, data states, and visible logout.
- The employee PWA now uses a compact authenticated header, visible logout, three-item bottom navigation (`Registro`, `Clientes`, `Programa`), single-column task flows, 48px primary actions, responsive customer cards, and explicit preview/confirmation states.
- The employee header derives the current tenant logo and name on the authenticated server boundary, shows an operator name only for an active shared-PIN session, and keeps connectivity UI hidden during normal online operation; offline blocking and relevant installation guidance remain visible.
- The employee PWA prevents focus, pinch and double-tap zoom: its form controls render at 16px, its route-specific viewport is fixed at scale 1 and its application shell accepts only pan gestures. The Admin interface keeps its unrestricted root viewport.
- The employee scanner now requests the rear camera only after an explicit action, continuously reads QR codes, validates the payload before submission, explains permission/device/offline failures, stops capture after success, and uses integrated name/phone search as its fallback without exposing manual token or URL entry.
- `/app/scan` is the single employee customer-identification view: its main surface stays focused on a compact camera scanner, while authorized name/phone search, results and Manager-only editing open in a bounded modal with a sticky form, result count and internal vertical scrolling. A successful scan or selected result opens one full-height mobile customer modal whose three guided steps cover customer overview, minimal operation input and explicit server-authoritative confirmation for either purchase or one-at-a-time redemption. The separate `/app/customers` route and the standalone Compra/Canje navigation tabs remain removed.
- The identified-customer modal consults migration `0047` for a backend-derived Apple device-registration state. When no active registration exists it offers an expandable claim QR and same-device fallback; once registered, it hides QR generation and shows the Wallet-added state without exposing device identifiers or push tokens.
- `/app/program` exposes every published card available to the current operator with its earning rule, active reward tiers, expiration rules and terms and conditions. Migration `0045` supplies tenant-derived read-only customer/program projections without accepting a browser tenant identifier.
- The employee PWA now ships 192px, 512px, maskable Android, and Apple touch icons; standalone metadata; launcher shortcuts; secure worker headers; Android/Chromium install affordance; iPhone/iPad home-screen guidance; and safe-area viewport metadata.
- The PWA exposes an accessible live connection indicator, blocks operational form submissions while offline, and falls back to a cached static connection notice without caching tenant data, sessions, authenticated routes, or operational responses.
- Supabase browser, server, and middleware clients share one SwiftWallet-specific auth cookie name and tokens-only encoding to reduce request headers and prevent local `431 Request Header Fields Too Large` failures after authentication.
- Existing `MANAGER` accounts are presented as Administradores de sucursal, retain personal password access to `/admin`, and remain restricted to assigned branches.
- Each branch can use individual employee credentials or one shared Auth account followed by six-digit personal PIN unlock.
- Shared-account JWTs cannot access branch data without a valid device-bound operator token propagated only from an HttpOnly cookie.
- PIN unlock enforces five-attempt/five-minute lockout, eight-hour inactivity expiry, explicit user switching, hashed PINs and revocable server-side sessions.
- Admin general configures branch access and shared credentials; assigned branch Administrators manage scoped individual employees and PIN operators.
- Customer creation, purchases, stamp ledger, redemptions and audit logs preserve the PIN operator alongside the technical shared account.
- Home, login, required-password change, public registration, and Web Card now share SwiftWallet tokens, controls, content hierarchy, accessibility states, and responsive public compositions.
- Admin general can copy each active branch's public registration link, download its PNG QR, and open the destination from `/admin/branches`; the link is derived from the server-configured public HTTPS origin.
- Admin general has an exclusive `/admin/customers` directory with bounded name/phone search, status filter, 50-row pagination, registration source, customer/card state, loyalty balances, available rewards and Apple Wallet generation diagnostics; Branch Administrators are redirected before data queries and do not see the navigation entry.
- Each active customer with an active issued card now has a “Mostrar QR” action in that directory. It opens an accessible dialog and generates the existing terms-and-Wallet claim QR on demand, avoiding bulk QR work while keeping the opaque token tenant-scoped by the Admin query.
- Public registration identifies the tenant and source branch, rejects invalid/inactive branch tokens and suspended tenants before rendering the form, and continues to create the customer and card atomically through the existing secure RPC.
- Employee registration now returns to the real `/app` route and replaces the dead `/app/register` destination with a compact delivery state. Its QR uses the configured public HTTPS origin in production and the current request host during local LAN development, so the customer opens the issued card on their own phone.
- The card claim screen keeps tenant identity, current terms, required acceptance and the Wallet/Web Card action together. Migration `0046` stores the accepted program version and immutable terms snapshot behind forced RLS, and the initial Apple endpoint rejects direct downloads until the current terms are accepted.
- Migration `0051` grants the server-only Apple issuance role access to that verification function. The targeted grant is applied on hosted Supabase and a live read-only check confirms the most recent accepted card now returns `true`; database verification errors no longer masquerade as missing acceptance in the updated route.
- Admin general can configure one Apple `storeCard` design per tenant with activation, text, accessible colors, logo, strip image, live preview, versioning, and immutable audit attribution.
- The Apple Wallet designer preview now mirrors the signed pass field order, overlays the balance on the official `375 × 144 pt` strip area, uses a realistic QR treatment and prepares matching 1x/2x/3x strip assets for the generated pass.
- Apple header identity now uses a logo canvas constrained to 160×50 while preserving the source aspect ratio, rather than centering every logo inside a wide transparent canvas. The front header no longer spends width on the reward count, the count remains on the back and the QR barcode omits its visible alternate text. Migration `0055` queues a one-time refresh for existing installed passes.
- Apple store-card fronts again show the available-reward count below the primary balance. Lifetime-point cards also show a five-segment progress value plus exact current/next milestone, and generate a dynamic progress strip for pre-iOS-26 Wallet versions. Migration `0057` queues installed passes after application deployment.
- The card design editor now accepts an optional square Apple notification logo without changing the visible header identity. Migration `0058` stores it per card, expands tenant Admin-only Storage paths, queues installed passes when it changes, and the generator emits it as the three PassKit icon assets with the normal card logo as fallback.
- The card design editor now exposes bounded size and horizontal/vertical margin
  controls for the logo and main image. Migration `0062` persists them per
  card, restricts mutation to the tenant Admin, queues installed Apple passes,
  and the server applies the same safe-area composition to 1x/2x/3x signed
  assets shown by the live preview. Google continues to control its own crop.
- The Apple main-image row now includes a compact, keyboard-native option to
  turn off the contrast darkening. Migration `0063` stores the choice per card,
  keeps dimming enabled for existing cards, queues installed passes and applies
  the choice to generated point/stamp strips without moving any Wallet fields.
- Cyclic cards now include a separate keyboard-native option to hide graphical
  stamp circles from Apple's main image. Migration `0064` stores the choice per
  card, keeps stamps visible for existing cards, queues installed passes and
  retains exact textual progress when the image is shown without circles.
- Google Wallet uses the same published card design to upsert one issuer-scoped loyalty class per card and one loyalty object per issued customer card. Issuance verifies current terms, includes the opaque Web Card QR, live balance/rewards, catalog, HTTPS imagery and up to ten active proximity locations, persists a provider-neutral pass record and redirects through a short signed Save to Google Wallet JWT. Credentials remain server-only and the customer UI uses Google's official Latin American Spanish badge.
- The public Web Card exposes an Apple download only when the tenant has enabled it and the complete signer configuration is present.
- The public Web Card renders the existing opaque public card token as a real high-contrast PNG QR without including customer data or a second identifier.
- The public Web Card represents cyclic progress with up to 24 branded stamp circles, fills earned positions with the tenant logo or initials, preserves the exact count for assistive technology and keeps unusually large goals bounded.
- A newly registered customer sees one terms-and-card claim screen; after accepting the current version, it continues directly to Apple Wallet when both signer configuration and tenant design are enabled or to the Web Card fallback.
- The Node-only Apple endpoint derives tenant, customer, program, balance, tiers, rewards, terms, and up to ten branch locations from the public card token, then emits a non-cacheable signed `.pkpass` and records pass status.
- Remote pass images require HTTPS plus an exact server allowlist, accepted raster content, a 5 MB limit, a 40 MP decode limit, no redirects, and a five-second timeout; invalid assets fall back safely.
- The Admin Wallet designer uploads PNG/JPEG/WebP assets of at most 5 MB directly to the public-read `wallet-assets` Supabase bucket, under generated `tenant_id/apple` paths.
- Storage RLS permits insert/update/delete only to an active Admin general in their own tenant path; Branch Administrators and cross-tenant paths are denied.
- Saving a replacement design removes the prior tenant-owned object, failed saves clean newly submitted objects, and the same-project Supabase hostname is accepted automatically by pass generation.
- Newly generated Apple passes include an HTTPS `webServiceURL` and stable HMAC-derived authentication token without storing the token in plaintext.
- The official PassKit register, unregister, changed-serial, updated-pass and log endpoints are implemented under `/api/wallet/apple/v1`.
- Migration `0038` adds monotonic update tags, encrypted device registrations, many-to-many pass registrations and a coalescing transactional outbox with forced RLS and service-role-only worker RPCs.
- Migration `0039` restores `service_role` usage of the update-tag sequence so the initial pass endpoint can insert `wallet_passes` rows; browser roles remain denied.
- Production migration `0039` was applied manually and the user confirmed Apple Wallet pass generation works again.
- Signed Apple passes now retain their QR barcode and branch locations by applying both through the PassKit generator methods that persist method-owned properties into `pass.json`.
- Signed Apple passes now generate customer-specific `strip.png`, `strip@2x.png` and `strip@3x.png` assets from the authoritative cyclic balance. Earned circles repeat the tenant logo or initials, large goals stay bounded at 24 positions, and exact textual progress remains in an auxiliary field for Wallet versions or devices that omit the strip.
- The multi-card design editor now previews the same Apple `storeCard` field hierarchy, 375 × 144 strip proportion, QR treatment, bounded stamp-slot calculation and configured unit copy used by signed passes. Text and color inputs update during interaction, newly selected logo/strip files use short-lived local object URLs before upload/save, current image thumbnails remain visible, and the editor explicitly distinguishes unsaved changes and Apple's iOS 26+ image limitations.
- Migration `0048` observes design/status changes on `loyalty_cards` and assignment changes on `loyalty_card_branches`, queues only installed passes issued from the affected card and preserves the service-role-only outbox boundary. Program, design and location saves all attempt immediate APNs dispatch after the transaction commits.
- Loyalty balance, reward, customer/card, program, tier, design, branding and branch-location changes queue pass updates transactionally.
- Purchase, redemption and relevant administrative actions attempt production APNs delivery immediately without making application success depend on Apple availability.
- APNs delivery uses HTTP/2, the existing pass certificate/private key and WWDR chain, an empty payload, Pass Type topic, bounded timeouts, invalid-token cleanup and per-device delivered tags.
- A Bearer-protected internal endpoint is ready for a future external retry scheduler; Hostinger shared cron remains unconfirmed and documented as pending.

## Pending Functionality

- Phase 11 Reviews and reputation product: separate Loyalty/Reviews
  entitlements, branch configuration, opaque QR/NFC sources, public landing,
  consented optional contact capture, versioned events, consumer offers/coupons
  and permission-scoped analytics. Google Business Profile synchronization and
  cross-product automation are later units. The reviewed scope and safeguards
  are recorded in `docs/reviews_plan.md` and `docs/PRODUCT.md` section 31.
- Stripe test-mode Product/Price synchronization, Checkout, Customer Portal, signature-verified webhooks, promotion reservation/cap consumption, affiliate attribution/commission accrual and membership-limit/grace enforcement.
- Configure the real scheduling, WhatsApp, email or form URL in `NEXT_PUBLIC_DEMO_REQUEST_URL`; until then the landing scrolls to its transparent pre-publication contact placeholder and collects no lead data.
- Generic imported-stamp conversion/milestone generation for lifetime-points programs; the Casa Garmendia one-time profile and configurable welcome-reward generation are complete.
- Remaining generic correction-policy interfaces, including configurable redemption-reversal enforcement; lifetime purchase/reward cancellation and manual point adjustments are already disabled in the backend.
- Admin/Manager UI for purchase cancellation, redemption reversal, stamp adjustments, reward cancellation, operational history, and audit logs.
- Automated E2E happy path and seeded-role integration validation.
- Deploy the QR/scanner correction, refresh or reinstall a pass, validate real-device scan and production APNs end to end, connect an external retry cron, configure/publish and validate Google Wallet on Android, and complete pilot sign-off.

## Active Blockers

- REVIEWS-001: Phase 11 can begin with domain/event design, but production PII
  capture requires an approved privacy notice, consent copy, retention/deletion
  policy and abuse limits. Google rating/review synchronization additionally
  requires approved Business Profile OAuth access and tenant location ownership.
- BILLING-001: The commercial migrations are applied, but Stripe test/live
  credentials, approved package prices, tax handling and payment policies have
  not been provided. Local promotion, attribution and webhook implementation can
  continue without enabling production payments.
- WALLET-001: Apple and Google issuance are implemented. The Google issuer/service account and publishing access, real Android save, locally corrected Apple QR, employee camera scan, pass refresh/reinstallation, APNs validation and external retry cron remain deployment or device-validation work.
- PILOT-001: Pilot tenant, privacy notice, support owner, and production approvals are not provided.

## Known Risks

- `npm audit --omit=dev` reports four high-severity runtime advisories in the pinned Next.js transitive `postcss`/`sharp` copies and the existing `xlsx` package. The Apple generator's Joi advisory was removed with a tested `17.13.4` override; unrelated framework/export dependency upgrades remain separate risk work.
- `npm install` reports an `EBADENGINE` warning for transitive `eslint-visitor-keys@5.0.1`, which requires Node `22.13+`; local Node is `22.12.0`. `npm ls`, lint, typecheck, tests, and build still pass.
- Production APNs validation, the licensed official Apple web badge, external retry scheduling, and Google Wallet issuer publishing/device validation require deployment configuration or external credentials.

## Last Validation Commands

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:run`: passed; 279 tests across 78 files.
- `npm run db:verify-rls`: passed through migration and test `0059`.
- `npm run db:verify-rls`: passed through migration and test `0062`, including
  image-layout ranges, Admin persistence and Branch Administrator denial.
- `npm run db:verify-rls`: passed through migration and test `0063`, including
  Admin persistence, null rejection and Branch Administrator denial.
- `npm run test:run`: passed; 283 tests across 78 files.
- Wallet image-layout editor: reviewed at 375, 768, 1280 and 1440 px; controls
  stack on mobile, remain keyboard-native, and keep the preview contained.
- Apple main-image dimming option: reviewed at 375, 768, 1280 and 1440 px;
  its label wraps without overflow, retains a 44 px target and stays beside the
  relevant image rather than adding another settings panel.
- `/superadmin/billing/packages` representative populated state: reviewed at 375, 768, 1280 and 1440 px; form, capabilities, responsive catalog, status and actions remain contained.
- `npm run build`: passed with webpack.
- `npm audit --omit=dev`: completed with 5 high runtime advisories; none originates from the QR scanner packages, and the framework/export fixes remain separate risk work.
- Temporary PostgreSQL 16 migration validation via Docker: passed.
- RLS behavior checks via `SET ROLE authenticated` and `request.jwt.claim.sub`: passed.
- Role/permission helper unit tests: passed.
- Auth redirect helper tests: passed.
- Tenant validation and server-only admin boundary tests: passed.
- `npm run db:verify-rls`: passed against disposable PostgreSQL 16 through migration/test `0040`.
- First-Administrator RPC integration assertions: passed.
- Administrator password-reset integration assertions: passed.
- Required password-change integration assertions: passed.
- Staff provisioning validation and server-boundary tests: passed.
- Staff branch assignment RPC integration assertions: passed.
- Branch update RLS assertions passed, including denial of an Admin attempting to update another tenant's branch.
- Customer/card migration and RLS integration assertions: passed.
- Phone normalization unit tests: passed; 11 cases.
- Public registration migration and anonymous RLS assertions: passed.
- Public registration validation and migration static tests: passed; 3 tests.
- Employee registration migration and assigned-branch assertions: passed.
- Customer profile management migration and cross-tenant assertions: passed.
- Public Web Card projection and unknown/revoked token assertions: passed.
- Loyalty schema, active-program uniqueness, nonnegative balance, ticket uniqueness, and RLS assertions: passed.
- Purchase preview/confirmation, balance locking, duplicate ticket, ledger, and reward-generation assertions: passed.
- Multiple-reward, versioned-rule, preserved-balance, and paused-program assertions: passed.
- PWA manifest, PNG dimensions, install runtime, secure worker headers, online-only cache boundary, and generated manifest route: passed.
- Scanner parser unit tests and cross-tenant card scan assertions: passed.
- Purchase route build and full application validation: passed.
- Reward redemption migration, tenant authorization, and one-time redemption assertions: passed.
- Strict geolocation trigger and pending-submit UI validations: passed.
- Audit trigger, append-only mutation denial, and actor attribution assertions: passed.
- Purchase cancellation, later-activity guard, reward consistency, and ledger restoration assertions: passed.
- Redemption reversal, reward re-availability, adjustment reason, role checks, and nonnegative balance assertions: passed.
- Reward cancellation, Administrator-only authorization, no-stamp-refund, and audit assertions: passed.
- Dashboard metrics scope, role filtering, minor-unit totals, and route build: passed.
- Branch comparison scope, date filters, and dashboard view build: passed.
- CSV export route allowlist, RLS scope, filters, and build: passed.
- Loyalty correctness migration through `0031`: passed against disposable PostgreSQL 16.
- Expiration, Web Card filtering, positive-adjustment rewards, lower-goal conversion, pause behavior, program-change ledger, and audit metadata assertions: passed.
- Loyalty program creation/configuration migration through `0032`: passed against disposable PostgreSQL 16.
- Currency precision, form validation, first-program creation, initial-balance conversion, pause/edit, audit metadata, cross-tenant denial, and role denial assertions: passed.
- Hosted migration application through `0033`: passed; 32 migration files are tracked remotely.
- Hosted Data API `app` schema RPC and server-key database checks: passed.
- Authenticated visual review passed at 375, 768, 1280, and 1440 px against the populated hosted tenant directory.
- Authenticated Administrator review passed at 375, 768, 1280, and 1440 px; public login passed at 375 and 1440 px. Because no active Manager/Employee or customer card exists yet, the exact production PWA and Web Card components were also reviewed with temporary representative data at 375 and 768 px, and all temporary routes were removed.
- PWA install guidance and online/offline notices were visually reviewed with exact production styles at 375 and 768 px; launcher icons and the maskable safe area were inspected, all temporary review routes were removed, and live `/manifest.webmanifest`, `/sw.js`, and `/offline.html` responses were verified.
- Tier editor and customer-card reward catalog were visually reviewed at 375, 768, 1280, and 1440 px; no overflow, hidden action, or one-off visual language was found, and the temporary review route was removed.
- The branded Web Card stamp grid was visually reviewed at 375, 768, 1280 and 1440 px with a balanced five-column maximum, no overflow and no visible numeric progress; the temporary review route was removed.
- Migration `0034` and its dedicated integration test passed cumulative 3/5/10 thresholds, current-cycle conversion, next-cycle rewards, remainder preservation, cancellation restoration, anonymous projection, direct-table denial, and duplicate-threshold rejection.
- Migration `0035` and its integration test passed branch-Administrator scope, shared-account bypass denial, PIN uniqueness, lockout, unlock, revocation, branch isolation, and actor attribution.
- Migration `0036` and its integration test passed Admin-only design mutation, Manager/anonymous denial, audit attribution, public availability filtering, and RLS/table-grant boundaries.
- Migration `0037` and its integration test passed bucket configuration, Admin-only own-tenant upload/delete, invalid filename rejection, cross-tenant denial, and Branch Administrator denial.
- Migration `0038` and its integration test passed encrypted/idempotent device registration, transactional customer and tenant update queuing, service-role-only claims, authenticated-role denial, per-device delivery tags, outbox completion, unregister cleanup and no work for uninstalled passes.
- Migration `0039` and its integration test passed a new `wallet_passes` insertion as `service_role`, automatic positive `update_tag` allocation, and denial of sequence access to `authenticated`.
- Apple Wallet update cryptography, APNs response classification, PassKit web-service boundaries and production route build passed focused and full test coverage.
- Customer QR generation produces a bounded PNG from only the opaque token; PassKit output preserves barcode/location properties; the operational scanner covers rear-camera configuration, automatic submission, offline denial and integrated customer-search fallback.
- Admin customer-directory filter parsing, pagination preservation, tenant scoping, role denial and navigation visibility passed focused tests; the responsive table/card rules were reviewed at the required 375, 768, 1280 and 1440 px breakpoints.
- Apple Wallet design/payload/integration tests passed; a disposable certificate smoke test produced a signed `.pkpass` ZIP.
- The graphical Apple Wallet strip generator passed exact 1x/2x/3x dimension checks and produces different PNG content when the customer balance changes. Its Admin preview was reviewed at 375, 768, 1280 and 1440 px without overflow; temporary review files and routes were removed.
- Authorized ignored local Apple credentials produced a valid signed graphical `.pkpass` containing `strip.png`, `strip@2x.png`, `strip@3x.png`, manifest hashes, signature and the exact `6 de 10 sellos` auxiliary fallback; no secret or validation route was committed.
- Authorized local Apple credentials produced a signed `.pkpass` ZIP with a matching, currently valid signer certificate; no secret was committed.
- The Wallet Storage designer passed Chrome review at 375, 768, 1280, and 1440 px; a prerender-only browser client bug and responsive file-input overflow were found and fixed, and the temporary review route was removed.

## Validation Results

- lint: passed.
- typecheck: passed.
- tests: passed.
- build: passed.

## Next Exact Step

Add transactional promotion reservation/cap consumption, then affiliate attribution before Checkout. Do not apply `0059`–`0061` remotely or begin Stripe live-mode work until hosted migration history, package pricing, taxes and payment policies are approved.
