# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable commit: pending Phase 7 import upload commit.
3. Git status: continuity update pending commit.
4. Current phase: Phase 7 - Superadmin And Importaciones.
5. Last completed task: Implemented Superadmin customer import schema and upload flow.
6. Task in progress: Implement column mapping and validation preview.
7. Relevant files: `supabase/migrations/0022_dashboard_metrics.sql`, `supabase/migrations/0023_dashboard_branch_metrics.sql`, `supabase/tests/0022_dashboard_metrics.sql`, `supabase/tests/0023_dashboard_branch_metrics.sql`, `src/app/admin/dashboard/page.tsx`.
8. Commands already passed: `npm run lint` with one existing Next image warning, `npm run typecheck`, `npm run test:run` with 93 tests, `npm run db:verify-rls`, and `npm run build`.
9. Pending commands: parser and mapping tests, then full validation after implementing preview.
10. Known problems: `npm audit --omit=dev` reports current high-severity advisories in Next.js transitive dependencies `postcss` and `sharp`; no safe automatic fix was applied because npm proposes a breaking downgrade. `npm install` warns that transitive `eslint-visitor-keys@5.0.1` prefers Node `22.13+`, while local Node is `22.12.0`; validation still passes.
11. Next exact action: Parse the stored CSV/XLSX upload server-side, expose detected columns for mapping, validate required name/phone fields and optional birth date/stamps, and add preview tests without inserting customers.
12. Files to read when resuming: `AGENTS.md`, `docs/PRODUCT.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, latest entry in `docs/WORK_LOG.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`, and `docs/IMPLEMENTATION_PLAN.md`.
13. Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; phone normalization and continuity commits were pushed successfully.
