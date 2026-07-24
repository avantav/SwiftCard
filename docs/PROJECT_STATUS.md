# Project Status

## Current State

- Current phase: Phase 2 - Clientes And Web Card.
- Current task: Add customer and card schema.
- Last completed task: Closed Phase 1 staff branch assignments and primary branch management.
- Current branch: `codex/swiftwallet-mvp`.
- Last stable commit: `01d2c8d feat: add staff branch assignments`.
- Git status: clean after the staff assignment continuity commit.
- Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; Phase 1 assignment commits were pushed successfully.

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

## Pending Functionality

- Phase 2 customer and card schema.
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
- `npm run test:run`: passed; 59 tests passed.
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

## Validation Results

- lint: passed.
- typecheck: passed.
- tests: passed.
- build: passed.

## Next Exact Step

Implement the Phase 2 customer and customer-card migration with tenant-scoped phone uniqueness, secure rotatable public tokens, and migration/RLS tests.
