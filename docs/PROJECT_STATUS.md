# Project Status

## Current State

- Current phase: Cross-cutting multi-card configuration and card-scoped loyalty operations; the separate Phase 8 Apple rollout validation remains pending externally.
- Current task: Deploy the validated additive multi-card migrations and complete the hosted draft/resume/publish/register/purchase smoke path.
- Last completed task: Implemented the four-stage multi-card Admin flow and card-scoped registration, purchase, Web Card and Apple Wallet projections.
- Current branch: `codex/swiftwallet-mvp`.
- Last stable feature: Admin general can create up to three durable card drafts, give each its own cyclic reward program, unified Apple/Android design and participating branches, then publish it and inspect card-specific metrics.
- Git status: Typecheck, lint, 192 application tests, production build and the complete disposable PostgreSQL migration/RLS suite through `0044` pass locally.
- Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; the new lifetime-configuration work is not pushed yet.

## Completed Functionality

- Product source normalized into `docs/PRODUCT.md`.
- Persistent repo instructions added in `AGENTS.md`.
- Executable implementation plan started.
- Next.js 16 App Router scaffold.
- Base routes: `/`, `/superadmin`, `/admin`, `/app`, `/register/[branchToken]`, `/card/[cardToken]`.
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
- Existing programs are backfilled to their current cyclic type; Admin type changes require confirmation, preserve historical data and begin paused. Entering lifetime points converts each current stamp balance with the configured multiplier, clears obsolete monetary remainder and records a ledger boundary without altering existing rewards. Additive migration `0042` repairs the same conversion if the type changed after online migration `0041` but before `0042`. Reward catalogs have no product-level count cap, and lifetime points remain forced to PAUSED until the decimal engine is connected.
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
- The employee PWA now uses a compact authenticated header, visible logout, five-item bottom navigation, single-column task flows, 48px primary actions, responsive customer cards, and explicit preview/confirmation states.
- The employee PWA prevents focus, pinch and double-tap zoom: its form controls render at 16px, its route-specific viewport is fixed at scale 1 and its application shell accepts only pan gestures. The Admin interface keeps its unrestricted root viewport.
- The employee scanner now requests the rear camera only after an explicit action, continuously reads QR codes, validates the payload before submission, explains permission/device/offline failures, stops capture after success, and retains manual entry as a fallback.
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
- Public registration identifies the tenant and source branch, rejects invalid/inactive branch tokens and suspended tenants before rendering the form, and continues to create the customer and card atomically through the existing secure RPC.
- Admin general can configure one Apple `storeCard` design per tenant with activation, text, accessible colors, logo, strip image, live preview, versioning, and immutable audit attribution.
- The Apple Wallet designer preview now mirrors the signed pass field order, overlays the balance on the official `375 × 144 pt` strip area, uses a realistic QR treatment and prepares matching 1x/2x/3x strip assets for the generated pass.
- The public Web Card exposes an Apple download only when the tenant has enabled it and the complete signer configuration is present.
- The public Web Card renders the existing opaque public card token as a real high-contrast PNG QR without including customer data or a second identifier.
- The public Web Card represents cyclic progress with up to 24 branded stamp circles, fills earned positions with the tenant logo or initials, preserves the exact count for assistive technology and keeps unusually large goals bounded.
- A newly registered customer sees a direct generic Apple Wallet action when both signer configuration and tenant design are enabled; the success screen no longer routes through the Web Card.
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
- Loyalty balance, reward, customer/card, program, tier, design, branding and branch-location changes queue pass updates transactionally.
- Purchase, redemption and relevant administrative actions attempt production APNs delivery immediately without making application success depend on Apple availability.
- APNs delivery uses HTTP/2, the existing pass certificate/private key and WWDR chain, an empty payload, Pass Type topic, bounded timeouts, invalid-token cleanup and per-device delivered tags.
- A Bearer-protected internal endpoint is ready for a future external retry scheduler; Hostinger shared cron remains unconfirmed and documented as pending.

## Pending Functionality

- Tenths-based lifetime point accounting, per-purchase truncation, one-time milestones, welcome/import generation, policy enforcement and Web Card/Apple Wallet progress for the new third program type.
- Admin/Manager UI for purchase cancellation, redemption reversal, stamp adjustments, reward cancellation, operational history, and audit logs.
- Automated E2E happy path and seeded-role integration validation.
- Deploy the QR/scanner correction, refresh or reinstall a pass, validate real-device scan and production APNs end to end, connect an external retry cron, implement Google pass generation, and complete pilot sign-off.

## Active Blockers

- WALLET-001: Initial issuance and the `0039` repair now work in production. The locally corrected visible QR, employee camera scan, pass refresh/reinstallation, APNs validation, external retry cron and Google Wallet remain pending deployment or external validation.
- PILOT-001: Pilot tenant, privacy notice, support owner, and production approvals are not provided.

## Known Risks

- `npm audit --omit=dev` reports four high-severity runtime advisories in the pinned Next.js transitive `postcss`/`sharp` copies and the existing `xlsx` package. The Apple generator's Joi advisory was removed with a tested `17.13.4` override; unrelated framework/export dependency upgrades remain separate risk work.
- `npm install` reports an `EBADENGINE` warning for transitive `eslint-visitor-keys@5.0.1`, which requires Node `22.13+`; local Node is `22.12.0`. `npm ls`, lint, typecheck, tests, and build still pass.
- Production APNs validation, the licensed official web badge, external retry scheduling, and Google Wallet require deployment configuration or external credentials.

## Last Validation Commands

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:run`: passed; 189 tests passed.
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
- Customer QR generation produces a bounded PNG from only the opaque token; PassKit output preserves barcode/location properties; the operational scanner covers rear-camera configuration, automatic submission, offline denial and manual fallback.
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

Apply validated migrations `0043` and `0044` to the hosted Supabase project with approval, then exercise create draft → resume → publish → register → scan → purchase → Apple refresh there. After that, resume the additive `LIFETIME_POINTS` engine; the separate APNs/Google rollout validation remains required before production scale.
