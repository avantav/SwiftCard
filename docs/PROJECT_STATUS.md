# Project Status

## Current State

- Current phase: Cross-phase MVP hardening before E2E; provider-specific Phase 8 work remains externally blocked.
- Current task: Resume authorized Admin/Manager correction and operational-history UI after completing the employee PWA installation layer.
- Last completed task: Added production-ready PWA installation, adaptive icons, secure service-worker registration, connection handling, and phone/tablet install guidance.
- Current branch: `codex/swiftwallet-mvp`.
- Last stable feature: Employee PWA installation and online-only connection handling.
- Git status: working tree expected clean after the continuity commit; local branch is ahead of origin.
- Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; current work is not pushed.

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
- Admin-only `/admin/staff` creation for Manager and Employee accounts.
- Server-only Auth provisioning with profile cleanup compensation.
- Tenant and creator derived from the authenticated Admin context.
- Atomic staff-to-branch assignment RPC with primary-branch promotion.
- Admin-only branch assignment controls on `/admin/staff`.
- Tenant-scoped `customers` and `customer_cards` schema with one card per customer.
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
- Hosted Supabase PostgreSQL 17 development database has all 32 repository migration files through `0033` applied and tracked; the development seed was not used.
- Application RPC calls explicitly target the exposed `app` schema while public administrative RPCs remain in `public`.
- Repeatable `npm run db:push:remote` migration runner refuses untracked existing SwiftWallet schemas and records canonical Supabase migration history.
- Compensating `npm run db:bootstrap:superadmin` flow creates an Auth user and active Superadmin profile without storing credentials in Git.
- Hosted development project has one confirmed active Superadmin, one active tenant, and one tenant Administrator; authenticated Superadmin routing is working.
- Mandatory enterprise design rules now cover layout, navigation, tokens, components, states, responsive behavior, accessibility, content, implementation, prohibited patterns, and completion review.
- Superadmin now uses a reusable enterprise shell with responsive navigation, active-route indication, account identity, visible logout, operational metrics, semantic tenant table, status actions, and explicit loading-result/error/empty/success treatments.
- Tenant creation, Administrator setup, branding, import upload, and import mapping routes now retain the same enterprise hierarchy and pending-submit behavior.
- Administrator now uses the shared dark enterprise sidebar, role-aware navigation, overview, operational lists, responsive dashboard table, consistent filters, forms, data states, and visible logout.
- The employee PWA now uses a compact authenticated header, visible logout, five-item bottom navigation, single-column task flows, 48px primary actions, responsive customer cards, and explicit preview/confirmation states.
- The employee PWA now ships 192px, 512px, maskable Android, and Apple touch icons; standalone metadata; launcher shortcuts; secure worker headers; Android/Chromium install affordance; iPhone/iPad home-screen guidance; and safe-area viewport metadata.
- The PWA exposes an accessible live connection indicator, blocks operational form submissions while offline, and falls back to a cached static connection notice without caching tenant data, sessions, authenticated routes, or operational responses.
- Home, login, required-password change, public registration, and Web Card now share SwiftWallet tokens, controls, content hierarchy, accessibility states, and responsive public compositions.

## Pending Functionality

- Admin/Manager UI for purchase cancellation, redemption reversal, stamp adjustments, reward cancellation, operational history, and audit logs.
- Automated E2E happy path and seeded-role integration validation.
- Apple/Google pass generation and updates, pilot tenant, privacy, and operational sign-off.

## Active Blockers

- WALLET-001: Apple Developer and Google Wallet credentials are unavailable.
- PILOT-001: Pilot tenant, privacy notice, support owner, and production approvals are not provided.

## Known Risks

- `npm audit --omit=dev` reports high-severity runtime advisories in Next.js transitive dependencies `postcss` and `sharp`; `npm audit fix --force` proposes a breaking downgrade to Next 9 and was not applied.
- `npm install` reports an `EBADENGINE` warning for transitive `eslint-visitor-keys@5.0.1`, which requires Node `22.13+`; local Node is `22.12.0`. `npm ls`, lint, typecheck, tests, and build still pass.
- Wallet integrations later require external Apple and Google credentials.

## Last Validation Commands

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:run`: passed; 127 tests passed.
- `npm run build`: passed with webpack.
- `npm audit --omit=dev`: completed with 3 high runtime advisories; no safe automatic fix.
- Temporary PostgreSQL 16 migration validation via Docker: passed.
- RLS behavior checks via `SET ROLE authenticated` and `request.jwt.claim.sub`: passed.
- Role/permission helper unit tests: passed.
- Auth redirect helper tests: passed.
- Tenant validation and server-only admin boundary tests: passed.
- `npm run db:verify-rls`: passed against disposable PostgreSQL 16.
- First-Administrator RPC integration assertions: passed.
- Administrator password-reset integration assertions: passed.
- Required password-change integration assertions: passed.
- Staff provisioning validation and server-boundary tests: passed.
- Staff branch assignment RPC integration assertions: passed.
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

## Validation Results

- lint: passed.
- typecheck: passed.
- tests: passed.
- build: passed.

## Next Exact Step

Implement the authorized Admin/Manager purchase-cancellation, redemption-reversal, stamp-adjustment, and reward-cancellation controls, then add permission-scoped operational and audit history views.
