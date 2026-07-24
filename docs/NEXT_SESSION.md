# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable commit: `710cfea feat: add permission scoped csv exports`.
3. Git status: continuity update pending commit.
4. Current phase: Phase 6 - Dashboard And Exportaciones.
5. Last completed task: Implemented and validated permission-scoped CSV exports.
6. Task in progress: XLSX exports, blocked by dependency approval.
7. Relevant files: `supabase/migrations/0022_dashboard_metrics.sql`, `supabase/migrations/0023_dashboard_branch_metrics.sql`, `supabase/tests/0022_dashboard_metrics.sql`, `supabase/tests/0023_dashboard_branch_metrics.sql`, `src/app/admin/dashboard/page.tsx`.
8. Commands already passed: `npm run lint` with one existing Next image warning, `npm run typecheck`, `npm run test:run` with 90 tests, and `npm run build`.
9. Pending commands: dependency approval; then XLSX format and permission tests.
10. Known problems: `npm audit --omit=dev` reports current high-severity advisories in Next.js transitive dependencies `postcss` and `sharp`; no safe automatic fix was applied because npm proposes a breaking downgrade. `npm install` warns that transitive `eslint-visitor-keys@5.0.1` prefers Node `22.13+`, while local Node is `22.12.0`; validation still passes.
11. Next exact action: Approve a specific XLSX dependency, then add it with the existing package manager and implement XLSX exports by reusing the CSV route's allowlist, filters, tenant context, and RLS boundary.
12. Files to read when resuming: `AGENTS.md`, `docs/PRODUCT.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, latest entry in `docs/WORK_LOG.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`, and `docs/IMPLEMENTATION_PLAN.md`.
13. Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; phone normalization and continuity commits were pushed successfully.
