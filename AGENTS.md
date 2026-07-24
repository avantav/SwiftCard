# SwiftWallet Codex Operating Rules

## Source Of Truth

1. Current explicit user instruction.
2. This `AGENTS.md`.
3. `docs/PRODUCT.md`.
4. `docs/DECISIONS.md`.
5. `docs/IMPLEMENTATION_PLAN.md`.
6. Existing code and tests.
7. Documented assumptions.

`docs/PRODUCT.md` is the primary product source for the MVP. Do not rely on chat history for requirements or continuity.

## Required Session Start

At the start of every session:

1. Read this file.
2. Read `docs/PRODUCT.md` completely.
3. Read `docs/IMPLEMENTATION_PLAN.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, `docs/DECISIONS.md`, and `docs/BLOCKERS.md` when present.
4. Run `git status`, `git branch --show-current`, and `git log --oneline -10`.
5. Inspect repository structure and package scripts.
6. Verify the real code state before continuing.
7. Resume from the first incomplete task.

## Work Cycle

For each unit of work:

1. Analyze the relevant requirement.
2. Plan the minimal complete change.
3. Implement incrementally.
4. Add or update focused tests.
5. Run relevant validation commands.
6. Review `git diff` for scope, security, and consistency.
7. Update continuity docs.
8. Commit stable work on a non-main branch.

## Git

- Do not work directly on `main`.
- Use `codex/swiftwallet-mvp` for autonomous MVP work unless a valid Codex branch already exists.
- Do not merge to `main`, force push, rewrite history, delete remote branches, delete tags, or discard user changes.
- Before each commit, check status and diff, run relevant validations, and ensure secrets are not included.

## Security

SwiftWallet is multi-tenant.

- Do not disable RLS to solve errors.
- Do not trust frontend-provided `tenant_id` as authority.
- Do not expose service role keys to the browser.
- Do not commit secrets.
- Store money in minor units.
- Keep critical operations atomic in PostgreSQL transactions or secure RPCs.
- Keep audit logs immutable from application paths.
- Sensitive operations must validate permissions on the backend.

## Scope

Do not add post-MVP features unless explicitly authorized. Excluded examples include customer portal/login, OTP, offline mode, POS integration, subscriptions, native mobile apps, marketing campaigns, support impersonation, and promotions.

