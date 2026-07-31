# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable commit before the current work: `a70236b feat: add role based root navigation and dev seed`.
3. Git status: loyalty correctness migration, tests, redemption filtering, and continuity docs pending commit.
4. Current focus: close earlier-phase operational gaps before the E2E pilot path.
5. Last completed task: migration `0031_loyalty_correctness.sql`.
6. Completed behavior: overdue rewards cannot be redeemed or displayed; positive adjustments and lower goals generate multiple rewards with remainders; program conversions create a ledger boundary; reward/program audit actions are accurate.
7. Relevant files: `supabase/migrations/0031_loyalty_correctness.sql`, `supabase/tests/0031_loyalty_correctness.sql`, `src/lib/loyalty/correctness.test.ts`, and `src/app/app/redeem/page.tsx`.
8. Commands passed: `npm run lint` with one pre-existing Next image warning, `npm run typecheck`, `npm run test:run` with 109 tests, `npm run db:verify-rls` through migration/test `0031`, and `npm run build`.
9. First incomplete internal task: implement Admin loyalty-program configuration and pause/resume controls using `app.update_loyalty_program`.
10. Following task: expose authorized purchase cancellation, redemption reversal, stamp adjustment, reward cancellation, operational history, and audit-log UI.
11. External blockers: `WALLET-001` and `PILOT-001` remain active.
12. Known risks: `npm audit --omit=dev` advisories and the local Node/transitive `eslint-visitor-keys` engine warning remain as previously documented.
13. Do not modify applied migrations; continue with additive migration numbers after `0031`.
