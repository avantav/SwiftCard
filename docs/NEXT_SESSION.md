# Next Session

1. Branch: `codex/swiftwallet-mvp`.
2. Last stable feature commit before this task: `8e898d2 feat: add installable employee PWA`.
3. Git status: working tree expected clean after the reward-editor fix commit; local branch is ahead of `origin/codex/swiftwallet-mvp`.
4. Current focus: return to authorized correction and operational-history UI after completing tiered rewards and card terms.
5. Last completed task: fixed local blank `/app` responses identified as HTTP 431 from a 16KB-plus cookie header; Supabase clients now share a SwiftWallet-specific cookie name and tokens-only encoding. Existing oversized localhost cookies still require one manual browser-site-data clear.
6. Completed behavior: every reward tier is generated at most once per cycle; small rewards remain available and do not consume progress; crossing the highest tier can also grant a lower reward in the next cycle; cancellation restores the prior cycle state.
7. Relevant files: `supabase/migrations/0034_tiered_rewards_and_card_terms.sql`, `supabase/tests/0034_tiered_rewards_and_card_terms.sql`, `src/app/admin/program/**`, `src/components/reward-tiers-editor.tsx`, `src/lib/admin/program.ts`, `src/lib/supabase/auth-cookies.ts`, the Supabase browser/server/middleware clients, and `src/app/globals.css`.
8. Commands passed for the latest auth-cookie fix: `npm run lint`, `npm run typecheck`, 135 Vitest tests, `npm run build`, and `git diff --check`. No database migration is required. Remote migration `0034` remains applied successfully.
9. Immediate step: implement the authorized correction actions in the Admin/Manager UI while reusing the mandatory shell, hierarchy, state, responsive, and accessibility rules.
10. First incomplete feature task: expose purchase cancellation, redemption reversal, stamp adjustment, and reward cancellation controls to authorized Admin/Manager users, followed by permission-scoped operational and audit history views.
11. External blockers: `WALLET-001` and `PILOT-001` remain active.
12. Known risks: `npm audit --omit=dev` advisories and the local Node/transitive `eslint-visitor-keys` engine warning remain as previously documented.
13. Do not modify applied migrations; continue with additive migration numbers after `0034`.
