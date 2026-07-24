# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable commit: `123b713 feat: add admin staff provisioning`.
3. Git status: clean after the staff provisioning commit; this continuity update is awaiting commit.
4. Current phase: Phase 1 - Multi-Tenant And Authentication.
5. Last completed task: Implemented Admin Manager/Employee staff provisioning.
6. Task in progress: Implement staff branch assignments and primary branch management.
7. Relevant files: `src/app/admin/staff/**`, `src/lib/admin/staff.ts`, `src/lib/admin/staff.test.ts`, `src/app/admin/branches/**`, `src/lib/auth/server.ts`, `src/lib/supabase/admin.ts`, `supabase/migrations/0001_initial_auth_tenancy.sql`.
8. Commands already passed: `npm run db:verify-rls` through migration `0004`, `npm run lint`, `npm run typecheck`, `npm run test:run` with 56 tests, and `npm run build`.
9. Pending commands: rerun focused tests and the full quality gate after staff branch-assignment implementation.
10. Known problems: `npm audit --omit=dev` reports current high-severity advisories in Next.js transitive dependencies `postcss` and `sharp`; no safe automatic fix was applied because npm proposes a breaking downgrade. `npm install` warns that transitive `eslint-visitor-keys@5.0.1` prefers Node `22.13+`, while local Node is `22.12.0`; validation still passes.
11. Next exact action: Add an Admin-only staff assignment action that takes a staff profile id and branch id, verifies both rows belong to `context.tenantId`, allows only Manager/Employee profiles, enforces assignments only to active branches, and preserves exactly one primary assignment using an atomic PostgreSQL RPC with positive/negative RLS tests.
12. Files to read when resuming: `AGENTS.md`, `docs/PRODUCT.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, latest entry in `docs/WORK_LOG.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`, and `docs/IMPLEMENTATION_PLAN.md`.
13. Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; commit `123b713` and the preceding branch-management commit await push.
