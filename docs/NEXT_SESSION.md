# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable feature commit before hosted setup: `73bdb9b feat: add admin loyalty program controls`.
3. Git status: working tree expected clean after the hosted-setup commit; local branch is ahead of `origin/codex/swiftwallet-mvp`.
4. Current focus: bootstrap and inspect the hosted development UI before continuing feature development.
5. Last completed task: applied all 32 migration files through `0033_expose_app_api_schema.sql` to the new hosted Supabase PostgreSQL 17 project and verified the Data API.
6. Completed behavior: repeatable remote migrations with canonical history, explicit `app` schema RPC routing, modern Supabase key-name support with legacy fallback, and a compensated one-time Superadmin bootstrap command.
7. Relevant files: `scripts/apply-remote-migrations.mjs`, `scripts/bootstrap-superadmin.mjs`, `supabase/migrations/0033_expose_app_api_schema.sql`, `src/lib/supabase/config.ts`, and `src/lib/supabase/*schema.test.ts`/`bootstrap.test.ts`.
8. Commands passed: `npm run lint` with one pre-existing Next image warning, `npm run typecheck`, `npm run test:run` with 118 tests, `npm run db:verify-rls` through migration `0033`, `npm run db:push:remote`, and live hosted Data API checks.
9. Immediate step: add the three local-only `SWIFTWALLET_BOOTSTRAP_SUPERADMIN_*` values, run `npm run db:bootstrap:superadmin`, start the app, and create the first tenant/Administrator through the UI.
10. First incomplete feature task after UI review: expose purchase cancellation, redemption reversal, stamp adjustment, and reward cancellation controls to authorized Admin/Manager users, followed by permission-scoped operational and audit history views.
11. External blockers: `WALLET-001` and `PILOT-001` remain active.
12. Known risks: `npm audit --omit=dev` advisories and the local Node/transitive `eslint-visitor-keys` engine warning remain as previously documented.
13. Do not modify applied migrations; continue with additive migration numbers after `0033`.
