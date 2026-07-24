# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable commit: `c423fc8 feat: add administrator temporary password reset`; mandatory-change work is awaiting commit.
3. Git status: mandatory-change route, route guards, migration, tests, and continuity updates are uncommitted while this unit is finalized.
4. Current phase: Phase 1 - Multi-Tenant And Authentication.
5. Last completed task: Implemented mandatory password change and server-side route guards.
6. Task in progress: Implement minimum branch management.
7. Relevant files: `src/app/change-password/**`, `src/app/admin/layout.tsx`, `src/app/app/layout.tsx`, `src/app/superadmin/layout.tsx`, `src/lib/auth/server.ts`, `src/lib/auth/routes.ts`, `src/app/login/actions.ts`, `supabase/migrations/0004_complete_required_password_change.sql`, `supabase/tests/0004_complete_required_password_change.sql`.
8. Commands already passed: `npm run db:verify-rls`, `npm run lint`, `npm run typecheck`, `npm run test:run` with 47 tests, and `npm run build`.
9. Pending commands: rerun focused tests and the full quality gate after branch-management implementation.
10. Known problems: `npm audit --omit=dev` reports current high-severity advisories in Next.js transitive dependencies `postcss` and `sharp`; no safe automatic fix was applied because npm proposes a breaking downgrade. `npm install` warns that transitive `eslint-visitor-keys@5.0.1` prefers Node `22.13+`, while local Node is `22.12.0`; validation still passes.
11. Next exact action: Add `/admin/branches` with an Admin-only list and create form; derive `tenant_id` from `requireInternalArea("ADMIN")`, reject Manager mutations, validate branch name/address/geofence and optional coordinates, insert through the authenticated RLS client, and add validation plus tenant-isolation regression tests.
12. Files to read when resuming: `AGENTS.md`, `docs/PRODUCT.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, latest entry in `docs/WORK_LOG.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`, and `docs/IMPLEMENTATION_PLAN.md`.
13. Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; password-reset commits are pushed and mandatory-change work is awaiting push.
