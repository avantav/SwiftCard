# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable feature commit: `73bdb9b feat: add admin loyalty program controls`.
3. Git status: working tree expected clean after the continuity commit; local branch is ahead of `origin/codex/swiftwallet-mvp`.
4. Current focus: close earlier-phase operational gaps before the E2E pilot path.
5. Last completed task: Admin loyalty program creation/configuration through migration `0032_loyalty_program_creation.sql`.
6. Completed behavior: Admin-only `/admin/program` creates the first program, edits rules/rewards/name, pauses/reactivates, converts amounts by tenant-currency precision, converts qualifying pre-existing balances, and writes full audit metadata.
7. Relevant files: `supabase/migrations/0032_loyalty_program_creation.sql`, `supabase/tests/0032_loyalty_program_creation.sql`, `src/lib/admin/program.ts`, `src/lib/admin/program.test.ts`, and `src/app/admin/program/**`.
8. Commands passed: `npm run lint` with one pre-existing Next image warning, `npm run typecheck`, `npm run test:run` with 114 tests, `npm run db:verify-rls` through migration/test `0032`, and `npm run build`.
9. First incomplete internal task: expose purchase cancellation, redemption reversal, stamp adjustment, and reward cancellation controls to authorized Admin/Manager users.
10. Following task: add permission-scoped operational history and audit-log views.
11. External blockers: `WALLET-001` and `PILOT-001` remain active.
12. Known risks: `npm audit --omit=dev` advisories and the local Node/transitive `eslint-visitor-keys` engine warning remain as previously documented.
13. Do not modify applied migrations; continue with additive migration numbers after `0032`.
