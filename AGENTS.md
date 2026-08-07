# SwiftWallet Codex Operating Rules

## Source Of Truth

1. Current explicit user instruction.
2. This `AGENTS.md`.
3. `docs/PRODUCT.md`.
4. `docs/DESIGN_SYSTEM.md` for every UI, UX, frontend, content, or visual decision.
5. `docs/DECISIONS.md`.
6. `docs/IMPLEMENTATION_PLAN.md`.
7. Existing code and tests.
8. Documented assumptions.

`docs/PRODUCT.md` is the primary product source for the MVP. Do not rely on chat history for requirements or continuity.

## Required Session Start

At the start of every session:

1. Read this file.
2. Read `docs/PRODUCT.md` completely.
3. Read `docs/DESIGN_SYSTEM.md` completely.
4. Read `docs/IMPLEMENTATION_PLAN.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION.md`, `docs/DECISIONS.md`, and `docs/BLOCKERS.md` when present.
5. Run `git status`, `git branch --show-current`, and `git log --oneline -10`.
6. Inspect repository structure and package scripts.
7. Verify the real code state before continuing.
8. Resume from the first incomplete task.

## Work Cycle

For each unit of work:

1. Analyze the relevant requirement.
2. Plan the minimal complete change.
3. Implement incrementally.
4. Add or update focused tests.
5. Run relevant validation commands.
6. For UI work, verify every applicable item in the mandatory checklist in `docs/DESIGN_SYSTEM.md`.
7. Review `git diff` for scope, security, design-system compliance, and consistency.
8. Update continuity docs.
9. Commit stable work on a non-main branch.

## Design

`docs/DESIGN_SYSTEM.md` is mandatory for all interface work.

- Read it before modifying routes, layouts, components, styles, visual assets, interface copy, or interaction states.
- Follow its tokens, hierarchy, responsive behavior, accessibility requirements, component rules, and prohibited patterns strictly.
- Reuse established shells and components instead of creating page-specific visual languages.
- Do not copy Verkada branding or proprietary UI; use only the documented enterprise design principles while preserving SwiftWallet identity.
- Do not mark UI work complete until the applicable design checklist has been reviewed.
- Any intentional exception requires explicit user authorization and a recorded entry in `docs/DECISIONS.md`.

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
