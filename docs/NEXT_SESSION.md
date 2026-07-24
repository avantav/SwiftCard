# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable commit: `e1e426f feat: add loyalty edge case coverage`.
3. Git status: continuity update pending commit.
4. Current phase: Phase 2 - Clientes And Web Card.
5. Last completed task: Implemented multiple reward generation, pause behavior, and versioned rule changes.
6. Task in progress: Add PWA manifest and install metadata.
7. Relevant files: `supabase/migrations/0013_purchase_operations.sql`, `supabase/tests/0013_purchase_operations.sql`, `supabase/tests/0014_program_changes.sql`, `src/lib/loyalty/{purchase,program-changes}.test.ts`.
8. Commands already passed: `npm run db:verify-rls`, `npm run lint` with one existing Next image warning, `npm run typecheck`, `npm run test:run` with 80 tests, and `npm run build`.
9. Pending commands: PWA manifest/install metadata implementation and validation.
10. Known problems: `npm audit --omit=dev` reports current high-severity advisories in Next.js transitive dependencies `postcss` and `sharp`; no safe automatic fix was applied because npm proposes a breaking downgrade. `npm install` warns that transitive `eslint-visitor-keys@5.0.1` prefers Node `22.13+`, while local Node is `22.12.0`; validation still passes.
11. Next exact action: Add `app/manifest.ts` or equivalent PWA manifest metadata with the SwiftWallet name, standalone display, theme colors, and no secrets, then validate the build and route output.
12. Files to read when resuming: `AGENTS.md`, `docs/PRODUCT.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, latest entry in `docs/WORK_LOG.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`, and `docs/IMPLEMENTATION_PLAN.md`.
13. Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; phone normalization and continuity commits were pushed successfully.
