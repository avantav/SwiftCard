# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable commit: `151f289 feat: enforce password change and route access`; branch management is awaiting commit.
3. Git status: branch listing/creation, tests, styles, and continuity updates are uncommitted while this unit is finalized.
4. Current phase: Phase 1 - Multi-Tenant And Authentication.
5. Last completed task: Implemented minimum Admin branch management.
6. Task in progress: Implement tenant staff account provisioning.
7. Relevant files: `src/app/admin/branches/**`, `src/lib/admin/branches.ts`, `src/lib/admin/branches.test.ts`, `src/lib/auth/server.ts`, `src/lib/supabase/admin.ts`, `supabase/migrations/0001_initial_auth_tenancy.sql`.
8. Commands already passed: `npm run lint`, `npm run typecheck`, `npm run test:run` with 51 tests, and `npm run build`; the prior `npm run db:verify-rls` passed through migration `0004`.
9. Pending commands: rerun RLS and the full quality gate after staff-provisioning implementation.
10. Known problems: `npm audit --omit=dev` reports current high-severity advisories in Next.js transitive dependencies `postcss` and `sharp`; no safe automatic fix was applied because npm proposes a breaking downgrade. `npm install` warns that transitive `eslint-visitor-keys@5.0.1` prefers Node `22.13+`, while local Node is `22.12.0`; validation still passes.
11. Next exact action: Add `/admin/staff` for Admin-only Manager/Employee creation; validate name/email/role/temporary password, derive `tenant_id` and `created_by` from `requireInternalArea("ADMIN")`, create Auth only through the server-only admin client, create `PASSWORD_RESET_REQUIRED` profile atomically, compensate Auth on profile failure, and add positive/negative tests.
12. Files to read when resuming: `AGENTS.md`, `docs/PRODUCT.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, latest entry in `docs/WORK_LOG.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`, and `docs/IMPLEMENTATION_PLAN.md`.
13. Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; mandatory-change commits are pushed and branch management is awaiting push.
