# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable commit: `a381066 feat: add customer and card schema`.
3. Git status: clean after the customer/card schema continuity commit.
4. Current phase: Phase 2 - Clientes And Web Card.
5. Last completed task: Added tenant-scoped customer and customer-card schema.
6. Task in progress: Implement phone normalization with tests.
7. Relevant files: `supabase/migrations/0006_customers_and_cards.sql`, `supabase/tests/0006_customers_and_cards.sql`, `scripts/verify-rls.mjs`, `src/lib/supabase/migrations.test.ts`.
8. Commands already passed: `npm run db:verify-rls` through migration `0006`, `npm run lint`, `npm run typecheck`, `npm run test:run` with 59 tests, and `npm run build`.
9. Pending commands: phone normalization implementation and customer duplicate tests.
10. Known problems: `npm audit --omit=dev` reports current high-severity advisories in Next.js transitive dependencies `postcss` and `sharp`; no safe automatic fix was applied because npm proposes a breaking downgrade. `npm install` warns that transitive `eslint-visitor-keys@5.0.1` prefers Node `22.13+`, while local Node is `22.12.0`; validation still passes.
11. Next exact action: Add `src/lib/customers/phone.ts` with deterministic normalization tests for Mexican and international inputs, then use it before customer duplicate checks.
12. Files to read when resuming: `AGENTS.md`, `docs/PRODUCT.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, latest entry in `docs/WORK_LOG.md`, `docs/DECISIONS.md`, `docs/BLOCKERS.md`, and `docs/IMPLEMENTATION_PLAN.md`.
13. Remote backup: branch tracks `origin/codex/swiftwallet-mvp`; customer/card schema and continuity commits were pushed successfully.
