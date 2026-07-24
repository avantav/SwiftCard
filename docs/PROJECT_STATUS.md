# Project Status

## Current State

- Current phase: Phase 2 - Clientes And Web Card.
- Current task: Implement reward cancellation rules.
- Last completed task: Implemented redemption reversal and manual stamp adjustments.
- Current branch: `codex/swiftwallet-mvp`.
- Last stable commit: `3dfc1d4 feat: add purchase cancellation`.
- Git status: continuity update pending commit.
- Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; phone normalization and continuity commits were pushed successfully.

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

## Pending Functionality

- Reward cancellation rules.
- All later MVP functional phases.

## Active Blockers

- None.

## Known Risks

- `npm audit --omit=dev` reports high-severity runtime advisories in Next.js transitive dependencies `postcss` and `sharp`; `npm audit fix --force` proposes a breaking downgrade to Next 9 and was not applied.
- `npm install` reports an `EBADENGINE` warning for transitive `eslint-visitor-keys@5.0.1`, which requires Node `22.13+`; local Node is `22.12.0`. `npm ls`, lint, typecheck, tests, and build still pass.
- Wallet integrations later require external Apple and Google credentials.

## Last Validation Commands

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:run`: passed; 73 tests passed.
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
- PWA manifest unit test and generated manifest route: passed.
- Scanner parser unit tests and cross-tenant card scan assertions: passed.
- Purchase route build and full application validation: passed.
- Reward redemption migration, tenant authorization, and one-time redemption assertions: passed.
- Strict geolocation trigger and pending-submit UI validations: passed.
- Audit trigger, append-only mutation denial, and actor attribution assertions: passed.
- Purchase cancellation, later-activity guard, reward consistency, and ledger restoration assertions: passed.
- Redemption reversal, reward re-availability, adjustment reason, role checks, and nonnegative balance assertions: passed.

## Validation Results

- lint: passed.
- typecheck: passed.
- tests: passed.
- build: passed.

## Next Exact Step

Implement reward cancellation rules for Administrador, preserving stamps and recording the action in audit history.
