# Decisions

## DEC-0001 - Continuity Documentation Is Repository-Owned

- Date: 2026-07-23
- Context: The project must be resumable without relying on chat history.
- Decision: Keep the product source, plan, status, work log, decisions, blockers, next-session recovery note, and traceability matrix inside `docs/`.
- Alternatives considered: Keeping status only in chat, or using a single status file.
- Reason: The repository must contain enough state for a new session to resume safely.
- Consequences: Every stable work unit must update documentation before commit.
- Status: Accepted.

## DEC-0002 - Use Webpack For Production Build In Local Scaffold

- Date: 2026-07-23
- Context: Next.js 16 uses Turbopack during `next build`, but Turbopack failed in the sandbox while processing CSS because it attempted to bind a helper process port.
- Decision: Use `next build --webpack` for the project build script and set `turbopack.root` to the repository root for future dev/build commands that use Turbopack.
- Alternatives considered: Downgrade Next.js, remove Tailwind/PostCSS, or request broad sandbox changes for every build.
- Reason: Webpack build passes in the current environment while preserving current Next.js and React versions.
- Consequences: Production build uses webpack until Turbopack can run reliably in the project environment.
- Status: Accepted.

## DEC-0003 - Public Tables With App Schema RLS Helpers

- Date: 2026-07-23
- Context: Supabase defaults expose `public` tables through PostgREST, while RLS policies need reusable session-derived tenant and branch checks without trusting frontend-provided `tenant_id`.
- Decision: Keep MVP data tables in `public` and place reusable authorization helpers in the `app` schema as `security definer` functions.
- Alternatives considered: Put all tables in a private schema, duplicate policy expressions inline, or defer RLS helper design until application routes exist.
- Reason: Public tables match Supabase conventions, while app-scoped helpers reduce RLS recursion risk and keep tenant/branch checks consistent.
- Consequences: Future migrations must grant helper execution intentionally and keep app helper functions free of frontend-controlled authority.
- Status: Accepted.

## DEC-0004 - Compensated Auth Provisioning With Atomic Profile Creation

- Date: 2026-07-23
- Context: Creating a Supabase Auth user and the tenant staff profile crosses the Auth API and application data boundary, while concurrent first-Administrator requests must not create two initial Administrators.
- Decision: Create the Auth user server-side, create the profile through a service-role-only PostgreSQL function protected by a tenant-scoped advisory transaction lock, and delete the new Auth user if profile creation fails.
- Alternatives considered: Insert the profile directly from the server action, add a permanent one-Administrator unique constraint, or create staff profiles from a generic `auth.users` trigger.
- Reason: The RPC makes the first-profile decision atomic without forbidding future additional Administrators, and compensation prevents ordinary failures from leaving orphan Auth users.
- Consequences: A failed compensation is surfaced as an explicit operational error; the service role boundary and RPC grants require regression tests.
- Status: Accepted.

## DEC-0005 - Dynamic Route Guards And Server-Only Password Completion

- Date: 2026-07-24
- Context: Authentication middleware only proves a Supabase session exists; internal areas also require role, staff status, tenant status, and mandatory password-change enforcement.
- Decision: Guard each internal route tree in a force-dynamic server layout, redirect reset-required users to `/change-password`, and keep profile activation behind a service-role-only RPC invoked after the server updates Auth.
- Alternatives considered: Put role claims in cookies/JWT metadata, rely on client navigation guards, or grant the completion RPC directly to authenticated users.
- Reason: Server layouts always read current RLS-protected database state, while the service-role RPC prevents users from activating their profile without changing the Auth password.
- Consequences: Protected route trees are dynamically rendered and require Supabase configuration at request time; build-time prerendering is intentionally disabled for them.
- Status: Accepted.

## DEC-0006 - Reward Expiration Uses Enforcement Plus Lazy Sweeps

- Date: 2026-07-30
- Context: Reward expiration must be authoritative even when no external scheduler is configured for the MVP.
- Decision: Reject and transition an expired reward inside the redemption RPC, sweep due rewards when an authenticated staff reward list is opened, and independently exclude overdue rewards from the anonymous Web Card projection.
- Alternatives considered: Rely only on a scheduled job, leave overdue rows as AVAILABLE until redemption, or calculate a display-only effective status.
- Reason: The critical redemption boundary remains correct without infrastructure assumptions, while staff and public views stop presenting overdue rewards.
- Consequences: `EXPIRED` transitions are auditable; a future scheduled sweep may call the same tenant-scoped operation but is not required for redemption safety.
- Status: Accepted.

## DEC-0007 - Program Goal Changes Create A Ledger Boundary

- Date: 2026-07-30
- Context: Lowering a reward goal can convert existing balances into rewards, and a later purchase cancellation must not reconstruct a balance across that conversion.
- Decision: Serialize program changes with balance-mutating operations, convert qualifying balances atomically, and append a zero-delta `PROGRAM_CHANGE` ledger entry for every converted customer.
- Alternatives considered: Recalculate cancellations through historical program versions, generate rewards without a ledger marker, or block all goal changes while customers have balances.
- Reason: The ledger marker preserves an explicit consistency boundary and lets the existing later-activity cancellation guard reject unsafe reversals.
- Consequences: Purchases before a converting goal change cannot be cancelled through the simple rollback path; an operator must use an audited corrective adjustment when appropriate.
- Status: Accepted.

## DEC-0008 - Expose Permission-Scoped Application RPCs Explicitly

- Date: 2026-08-02
- Context: SwiftWallet stores authorization helpers and critical RPCs in the `app` schema, but hosted Supabase exposes `public` by default and unqualified Supabase client RPC calls resolve only against the default schema.
- Decision: Expose `app` alongside `public` and `graphql_public`, keep `public` as the default schema, and route every `app.*` RPC through `supabase.schema("app").rpc(...)`.
- Alternatives considered: Move critical functions into `public`, add public wrapper functions, or make `app` the default Data API schema.
- Reason: Explicit schema routing preserves the existing database boundary, avoids duplicating the API surface, and keeps ordinary table access in `public`.
- Consequences: Hosted environments must apply migration `0033`; all new `app` RPC call sites must select the schema explicitly, while function grants remain the authority boundary.
- Status: Accepted.

## DEC-0009 - Mandatory Enterprise Design System

- Date: 2026-08-02
- Context: Existing screens were implemented incrementally and do not yet share a sufficiently rigorous enterprise visual and interaction standard.
- Decision: Adopt `docs/DESIGN_SYSTEM.md` as the mandatory UI source of truth and require it in session startup, implementation review, and completion criteria through `AGENTS.md`.
- Alternatives considered: Keep visual guidance informal, redesign only the Superadmin page, or copy a third-party interface directly.
- Reason: A repository-owned system creates consistent navigation, hierarchy, density, accessibility, responsive behavior, and interaction states across future work without relying on chat history.
- Consequences: Every modified interface must move toward the shared system, applicable checklist items must be verified, and exceptions require explicit user authorization plus a recorded decision. Verkada remains conceptual inspiration only; SwiftWallet retains its own identity.
- Status: Accepted.

## DEC-0010 - PWA Remains Online-Only With A Static Offline Fallback

- Date: 2026-08-02
- Context: The employee PWA must be installable and communicate connection loss, while the MVP explicitly excludes offline operation and handles tenant, customer, purchase, and reward data.
- Decision: Register a root-scoped service worker that caches only a static, non-sensitive offline notice and uses the network for every application navigation and operation. Do not cache authenticated HTML, tenant data, API responses, Supabase traffic, or operational assets for offline use. Block operational form submissions when the browser reports no connection.
- Alternatives considered: Cache the authenticated application shell and recent data, omit the service worker entirely, or add background synchronization for queued operations.
- Reason: A static fallback supports a clear installed-app experience without creating stale financial operations, cross-user device leakage, queued double submissions, or an unsupported offline mode.
- Consequences: A cold offline launch displays only the connection notice; all customer and loyalty operations require restored connectivity. Any future offline capability requires explicit product authorization and a new security design.
- Status: Accepted.

## DEC-0011 - Cumulative Reward Tiers With A Highest-Tier Cycle Boundary

- Date: 2026-08-02
- Context: A tenant must be able to offer small rewards at intermediate stamp totals while preserving progress toward a larger reward, and customer cards must explain both the prize ladder and its terms.
- Decision: A loyalty program has uniquely ordered reward tiers. The original cyclic implementation limited the catalog to ten; DEC-0017 later removes that product-level cap. Each tier is granted at most once per customer cycle. Intermediate rewards accumulate without subtracting stamps; the highest threshold completes the cycle, preserves the remainder, and permits lower tiers in the next cycle to be reached in the same operation. Existing single-reward programs remain valid as one-tier programs. Terms and the active tier catalog are exposed through the public card projection.
- Alternatives considered: Deduct stamps for every small reward, make customers choose a reward, reset progress at every tier, or create separate loyalty programs per prize.
- Reason: The selected model supports progressive engagement without weakening atomic balance accounting, cancellation safety, or the existing remainder behavior.
- Consequences: Rewards store immutable tier, cycle, threshold, and program-version snapshots; purchases and adjustments record completed cycles separately from the number of rewards generated; changing active tiers creates an audited program-change boundary when it converts existing progress.
- Status: Accepted.

## DEC-0012 - Branch-Scoped Administration And Shared PIN Access

- Date: 2026-08-06
- Context: Branch Administrators need personal administrative accounts, while restaurant staff at selected branches must operate from a shared device account without individual email addresses.
- Decision: Preserve `MANAGER` internally and present it as Administrador de sucursal. Add an exclusive employee access mode per branch: individual credentials or one shared Auth account followed by a hashed six-digit operator PIN. A server-side HttpOnly token binds the unlocked operator to the shared Auth account and branch; RLS rejects the shared JWT without that token.
- Alternatives considered: New database role, one tenant-wide shared credential, storing reversible employee passwords, or attributing every action only to the shared account.
- Reason: The design preserves applied migrations and existing individual accounts while maintaining branch isolation and human attribution for loyalty operations.
- Consequences: Shared accounts are technical `EMPLOYEE` profiles, PIN sessions are revocable and expire after eight hours of inactivity, five failed attempts lock PIN entry for five minutes, and operational records store both the technical account and PIN operator.
- Status: Accepted.

## DEC-0013 - Tenant-Owned Apple Store Cards With Server-Only Signing

- Date: 2026-08-06
- Context: Tenants need distinct Apple Wallet designs while Apple constrains pass layouts and requires a signed local-resource bundle.
- Decision: Use one audited `storeCard` design per tenant, managed only by the Admin general. Generate `.pkpass` files on demand from the secure public card token, resize bounded HTTPS assets only from configured hosts, and keep the Pass Type ID, Team ID, signer certificate, private key, WWDR certificate, and password exclusively in server secrets.
- Alternatives considered: Arbitrary drag-and-drop layouts, storing certificates in the database, accepting unrestricted image URLs, or issuing unsigned passes.
- Reason: The fixed store-card model matches loyalty semantics, preserves tenant branding within Apple's supported fields, and keeps signing and tenant authority outside the browser.
- Consequences: The public download is visible only when both the tenant design and server signing config are enabled. Initial generation works without an Apple update web service; installed-pass updates and real-device validation remain separate Phase 8 work.
- Status: Accepted.

## DEC-0014 - Tenant-Scoped Public Wallet Asset Bucket

- Date: 2026-08-07
- Context: Admins need to upload Apple Wallet logos and strip images from the tenant configuration without copying external URLs, while the pass generator must fetch those assets without exposing privileged Storage credentials.
- Decision: Store Wallet raster assets in one public-read Supabase Storage bucket named `wallet-assets`, under generated `tenant_id/apple` object paths. Limit insert, update, and delete with Storage RLS to the active Admin general of that tenant; accept only PNG, JPEG, or WebP up to 5 MB and validate the submitted public URL again on the server before saving the design.
- Alternatives considered: Service-role uploads through Server Actions, private objects with signed URLs, one bucket per tenant, unrestricted external URLs, or storing image bytes in PostgreSQL.
- Reason: Direct browser uploads avoid Server Action body limits, public reads give the pass generator stable HTTPS assets, and tenant-path RLS preserves write isolation without proliferating buckets or exposing the service role.
- Consequences: Wallet images are intentionally public brand assets; replacing or clearing a saved design removes the previous tenant-owned object, failed submissions clean new objects when possible, and additional non-Supabase asset hosts still require `APPLE_WALLET_ASSET_HOSTS`.
- Status: Accepted.

## DEC-0015 - Transactional Apple Wallet Outbox With Immediate Dispatch

- Date: 2026-08-10
- Context: The deployed Hostinger shared plan supports Node.js but has no confirmed cron facility. Loyalty operations must update installed Apple passes without becoming dependent on APNs availability.
- Decision: Add `webServiceURL` and a stable HMAC-derived `authenticationToken` to every new Apple pass; store device identifiers only as keyed hashes and push tokens encrypted with AES-256-GCM; mark pass changes and coalesce an outbox record transactionally in PostgreSQL; then attempt APNs delivery immediately after successful application mutations. Keep failures in the outbox and expose a separate Bearer-protected retry endpoint for a future external scheduler.
- Alternatives considered: Call APNs inside PostgreSQL, make loyalty RPC success depend on APNs, store raw device/push tokens, require an unconfirmed Hostinger cron, or omit retries.
- Reason: The selected design preserves loyalty correctness during provider outages, works on the current Node hosting, keeps provider secrets out of the browser and database plaintext, and leaves a clean path to reliable scheduled retries.
- Consequences: A failed push can remain pending until another scoped operation or the protected retry endpoint runs. Connecting an external cron is documented as pending before production scale. Existing passes issued without update metadata must be removed and reinstalled after deployment.
- Status: Accepted.

## DEC-0016 - One Opaque Customer QR Across Wallet Channels

- Date: 2026-08-10
- Context: The customer card must identify the customer at the point of sale, but the Web Card displayed a placeholder and the PassKit generator silently discarded barcode and location properties passed only through its constructor. The employee scanner also lacked camera capture.
- Decision: Use the existing rotatable `customer_cards.public_token` as the only QR authority. Render it as a real high-contrast QR on the Web Card, encode the secure card URL as the Apple Wallet QR message, apply barcode and location data through the PassKit generator setter APIs, and decode QR codes on demand in the employee PWA with a rear-camera-first browser reader plus manual fallback.
- Alternatives considered: Encode customer UUID or phone, create a second Wallet-only token, rely on manual token entry, or request camera permission automatically on page load.
- Reason: One opaque identifier preserves the existing tenant-aware resolution RPC, avoids personal data in the barcode, works across Web Card and Apple Wallet, and keeps camera use explicit and recoverable.
- Consequences: Existing passes need an updated `.pkpass` or reinstallation to receive the visible QR. Camera scanning requires HTTPS or localhost and user permission; denial, unsupported devices and offline state retain the manual path. No database migration is required.
- Status: Accepted.

## DEC-0017 - Configurable Lifetime-Points Programs

- Date: 2026-08-12
- Context: Casa Garmendia requires one point per configurable whole-currency amount, lifetime progress that never resets, one-time milestones, an optional welcome reward, imported-stamp conversion and program-specific correction policies. Existing SwiftWallet programs must retain their cyclic behavior.
- Decision: Add an explicit three-way program type: stamps per purchase, stamps per amount, and lifetime points. Store configurable singular/plural unit names, welcome/import options, an integer import multiplier, and purchase-cancellation, reward-cancellation and redemption-reversal policies. Existing programs are backfilled to their current cyclic type. DEC-0019 supersedes the initial activity lock with a confirmed, audited Admin transition that starts paused and applies to future purchases. Reward catalogs have no product-level count cap, while each field remains bounded. The configuration foundation remains paused until the decimal calculation and one-time milestone engine are connected.
- Alternatives considered: Replace all programs with lifetime points, encode Garmendia as tenant-specific conditionals, approximate lifetime progress with an unreachable cycle goal, or expose the new type before persisting its policies.
- Reason: An explicit program type preserves backward compatibility and gives future tenants reusable options without weakening tenant authority or hiding behavior in customer-specific code.
- Consequences: Migration `0040` is required before the new Admin form can load. The next implementation unit must add tenths-based purchase accounting, one-time welcome/milestone generation, import conversion, policy enforcement and Web Card/Apple Wallet projections before lifetime points can be activated.
- Status: Accepted.

## DEC-0018 - Apple Store-Card Preview Mirrors The Signed Pass Structure

- Date: 2026-08-12
- Context: The Admin Wallet designer needs a useful visual preview, but Apple owns the final `storeCard` renderer and can vary typography, cropping and field fitting by OS and device.
- Decision: Model the preview from the same fixed field hierarchy and assets used by the signed pass: logo and logo text, header reward count, primary balance over a `375 × 144 pt` strip, one combined secondary/auxiliary row, and a square QR with alternate text. Resize the actual strip bundle to the same current Apple dimensions and keep a visible qualification that the browser preview is not an Apple renderer.
- Alternatives considered: Preserve the approximate decorative card, copy an Apple screenshot, make the layout tenant-configurable, or claim pixel-perfect equivalence across iOS versions.
- Reason: Structural parity gives the Admin an honest preview while respecting Apple's fixed layout, current image specification and ownership of final rendering.
- Consequences: The mock tracks fields, order, colors and image proportions closely, but final acceptance still requires Apple's Pass Designer or a signed pass on a real device when exact OS rendering matters.
- References: [Apple Wallet Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/wallet) and [Creating a store card pass](https://developer.apple.com/documentation/walletpasses/creating-a-store-card-pass).
- Status: Accepted.

## DEC-0019 - Confirmed Admin Program-Type Changes Start Paused

- Date: 2026-08-12
- Context: The Admin general needs to change an existing tenant program even after loyalty activity exists, without rewriting purchases, destroying balances or silently changing active operation.
- Decision: Allow only the active tenant `ADMIN` to change the existing program type through the tenant-scoped configuration RPC. Require explicit browser confirmation and require the changed program to be saved as `PAUSED`. Preserve rewards and immutable historical purchase rule/version snapshots. When entering `LIFETIME_POINTS`, atomically multiply each current stamp balance by the configured stamp-to-point multiplier, clear its obsolete monetary remainder, add a `PROGRAM_CHANGE` ledger entry per affected customer and reject integer overflow. Write dedicated type-change and balance-conversion audit events. `LIFETIME_POINTS` remains paused until its purchase engine is complete.
- Alternatives considered: Keep the permanent activity lock, delete and recreate the program, rewrite historical purchases, automatically activate the new type, or allow Branch Administrators to change it.
- Reason: A paused two-step transition gives the Admin the requested flexibility while preventing an accidental live rule switch and preserving the ledger as historical truth.
- Consequences: Migrations `0041` and `0042` are required. Because `0041` was already online, additive migration `0042` also repairs a program that entered lifetime points before the conversion trigger was installed. Cyclic type changes can be reviewed and activated in a second save; a change to lifetime points immediately converts existing balances but cannot be activated yet. Existing rewards retain their original program/tier snapshots.
- Status: Accepted.

## DEC-0020 - Server-Rendered Graphical Stamp Strip For Apple Wallet

- Date: 2026-08-12
- Context: The customer-facing Apple Wallet pass should resemble a physical stamp card, with earned circular positions filled by the tenant identity instead of making a number the dominant representation.
- Decision: For cyclic programs, render a customer-specific PNG strip on the trusted server from the current database balance and highest cycle goal. Produce Apple's 1x/2x/3x strip sizes, repeat the tenant logo or initials in earned positions, bound exceptionally large goals to 24 proportional indicators, include the generated assets in every newly signed `.pkpass`, and retain the exact balance as an auxiliary text field. A configured tenant strip remains an optional background underneath the generated progress.
- Alternatives considered: Generate the image in the browser, store one image per customer in Storage, update only an image URL, encode circles as pass-field text, or remove the textual balance entirely.
- Reason: Browser output cannot become trusted signed pass content, Apple pass images live inside the signed package, and the existing PassKit update service already regenerates the complete pass after transactional balance changes. A textual fallback preserves meaning when Wallet or Apple Watch omits or changes image presentation.
- Consequences: Every pass request performs bounded image composition and signing without persisting customer-specific images. APNs remains only a change signal; the device downloads the complete replacement pass with the same pass type and serial number. Apple's current Pass Designer compatibility table limits store-card strip display on some recent OS versions, so exact presentation requires a refreshed pass on the target iPhone and must not be the only source of balance truth.
- References: [Creating a store card pass](https://developer.apple.com/documentation/walletpasses/creating-a-store-card-pass), [Creating a pass with Pass Designer](https://developer.apple.com/documentation/walletpasses/creating-a-pass-with-pass-designer), and [Adding a web service to update passes](https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes).
- Status: Accepted.

## DEC-0021 - Card-Owned Programs, Locations, Design And Statistics

- Date: 2026-08-12
- Context: A tenant needs up to three distinct loyalty cards, including branch-exclusive cards, without mixing balances, rules, visuals or reporting and without maintaining one designer per device.
- Decision: Introduce a `loyalty_cards` configuration as the aggregate root. Every non-archived card owns exactly one loyalty program, one provider-neutral design and one or more branch assignments. A tenant can have at most three non-archived cards, enforced transactionally with an advisory lock. Creation immediately persists a `DRAFT`; program, design and locations are saved as independent completed stages, and publication requires all three. Existing tenant program/design/issued-card data backfills into one published card. In the MVP a customer still holds at most one issued card per tenant, but its opaque QR now identifies both customer and card so operations derive the correct program and allowed branches. Purchases, rewards and ledger activity carry the card scope for per-card statistics and history.
- Alternatives considered: Keep the tenant-wide program and change only the UI, create separate Apple and Android card records, store unfinished setup only in browser state, or allow the client to submit a program/tenant as authority.
- Reason: The aggregate prevents cross-card balance and reporting ambiguity, preserves the existing one-card-per-customer invariant, makes drafts resumable across devices and keeps wallet-specific rendering as an adapter over one business design.
- Consequences: Migrations `0043` and `0044` are additive and must be applied before the new Admin route. Legacy `/admin/program` and `/admin/wallet` redirect to `/admin/cards`. Public and employee registration require a published card assigned to the selected branch. Google pass generation remains pending, but its preview uses the same saved design contract as Apple.
- Status: Accepted.

## DEC-0022 - Unified Employee Customer Identification

- Date: 2026-08-15
- Context: Employees had separate scanner and customer-search routes, while the scanner also exposed a manual token/URL field that duplicated the secure camera path and added an implementation-facing control to the operational UI.
- Decision: Make `/app/scan` the single employee customer-identification view. Keep explicit rear-camera scanning, replace manual token/URL entry with authorized name-or-exact-phone search in a bounded native modal, resolve search results to the issued loyalty card and current operator scope, and remove the separate `/app/customers` route, navigation item and PWA shortcut. Preserve Manager-only customer editing inside the modal results.
- Alternatives considered: Keep both routes, keep manual token entry as a third path, or move camera scanning into the former customer-search page.
- Reason: One entry point reduces navigation and input ambiguity while preserving a usable fallback when camera access is denied or unsupported.
- Consequences: QR payload parsing remains an internal camera boundary, not an employee-facing text input. Search continues through existing customer/card RLS, and purchase links carry the backend-derived issued-card and loyalty-card identifiers required by multi-card operations. The base screen avoids rendering result lists below the camera; long search/edit content scrolls inside the modal and page scrolling is locked while it is open.
- Status: Accepted.

## DEC-0023 - Customer-Centered Employee Operations

- Date: 2026-08-15
- Context: After identification, Compra and Canje still lived as independent bottom-navigation destinations and required the employee to reconstruct customer context. Employees also lacked one operational view of the published reward catalog and terms.
- Decision: Keep exactly three employee tabs: `Registro`, `Clientes` and `Programa`. A successful QR scan or selected manual-search result opens a full-height mobile-first customer modal with identity, issued card, current balance, available rewards, one-reward redemption and a single dominant action to register a purchase. Compra and Canje remain protected internal workflows but are no longer standalone navigation tabs. Add a read-only program tab backed by authenticated, tenant-derived projections for earning rules, reward tiers and terms.
- Alternatives considered: Keep four tabs, add a fifth information tab, navigate directly from identification to Compra, or duplicate customer/reward data in separate routes.
- Reason: Point-of-sale work starts from a customer, not an operation category. Keeping the customer context visible reduces navigation, prevents accidental operation against the wrong customer and leaves the main scan surface compact.
- Consequences: Migration `0045` is required before the new modal and program tab can load in a hosted environment. It accepts only an opaque issued-card identifier for the customer projection, derives tenant/operator authority from `auth.uid()` and current PIN context, and exposes no write authority. Existing `/app/purchase` and `/app/redeem` routes remain for compatibility, but only customer-context actions are shown in primary navigation.
- Status: Accepted.

## DEC-0024 - Versioned Customer Card Handoff

- Date: 2026-08-15
- Context: Employee registration redirected to a nonexistent `/app/register` page, and Wallet issuance could begin without a customer-facing acceptance step. The point-of-sale handoff also needed to work from a LAN development origin and stay compact on a customer phone.
- Decision: Return successful employee registration to `/app`, render a QR for an absolute possession-based `/card/{token}?claim=1` link, and place tenant identity, current program terms, required acceptance and the one Wallet/Web Card action on a single mobile-first screen. Persist the accepted program version and an immutable terms snapshot, and gate the initial Apple Wallet endpoint on that acceptance.
- Alternatives considered: Keep a success link without QR, ask the employee to accept on the customer's behalf, store only a boolean, or let the public form download the pass before acceptance.
- Reason: The customer should make the consent action on their own device, while the backend retains evidence of exactly which terms version was accepted and direct endpoint access cannot bypass it.
- Consequences: Migration `0046` is required before the claim form and Apple Wallet download work in a hosted environment. The public link remains an opaque possession token and exposes no tenant ID, phone, internal card ID or balance. Production QR generation uses the configured HTTPS public origin; local development may use the current request host so another device on the LAN can scan it.
- Status: Accepted.

## DEC-0025 - Wallet-Aware Repeat Delivery From Customer Search

- Date: 2026-08-15
- Context: A customer may leave registration without adding the card, then return later and be found by employee search or scan. Staff needed a repeatable handoff without showing redundant controls after Wallet confirms installation.
- Decision: Add an authenticated read-only projection that accepts only the issued-card UUID already authorized by the customer summary, returns the opaque card token and reports Apple installation only when an active Wallet device registration exists. When not installed, the customer modal exposes a collapsed “Generar QR para agregar tarjeta” section using the same terms-and-claim flow; after registration, it shows status and hides the QR option.
- Alternatives considered: Always show the QR, treat pass generation as installation, read Wallet device tables directly from the browser, or add a separate delivery page.
- Reason: Apple device registration is stronger evidence of an added pass than generation alone. Keeping the option inside the existing modal preserves customer context and avoids another navigation destination.
- Consequences: Migration `0047` is required in hosted environments. Device identifiers and push-token data remain inaccessible; the projection returns only a boolean and the already possession-safe opaque card token after reusing tenant/operator authorization from the staff customer summary.
- Status: Accepted.

## DEC-0026 - Guided Customer Operation Modal

- Date: 2026-08-15
- Context: Putting purchase and redemption controls in one customer view removed navigation, but exposed too many choices at once and made the next action unclear after scanning or searching.
- Decision: Use one three-step mobile modal for both operations. Step one shows customer identity, card balance, reward availability and the operation choice. Step two asks only for the selected reward and branch, or purchase branch and readable currency amount. Step three shows an authoritative preview and requires explicit confirmation. Long customer searches keep the query form visible and identify every result with name, phone and card.
- Alternatives considered: Return to separate Compra/Canje tabs, place every field in one scrolling modal, or confirm operations immediately from the overview.
- Reason: Progressive disclosure keeps customer context visible while reducing error-prone choices and making irreversible actions explicit.
- Consequences: Purchase amounts are converted exactly to minor units on the server and previews are recalculated before confirmation. Existing protected RPCs and legacy routes remain compatible; no migration is required.
- Status: Accepted.

## DEC-0027 - Card-Owned Apple Preview And Update Propagation

- Date: 2026-08-18
- Context: After multi-card configuration moved design into `loyalty_cards`, the Admin preview still rendered a generic hard-coded 4-of-10 card and the Apple update triggers still observed only the legacy tenant-wide design table. Saving a card design could therefore call the dispatcher without creating outbox work, while program and location saves could queue work without attempting immediate delivery.
- Decision: Make the multi-card Apple preview consume the saved program goal, unit names, card design and the same tenant asset fallbacks used by pass generation. Share progress copy and bounded stamp-slot calculations between preview and signed pass code, preserve Apple's `storeCard` front hierarchy and 375 × 144 strip proportion, and identify Android as conceptual until generation exists. Add a card-scoped transactional queue function plus triggers for `loyalty_cards` design/status and `loyalty_card_branches` changes, then attempt immediate APNs dispatch after program, design and location saves.
- Alternatives considered: Continue the generic preview, restore writes to `tenant_wallet_designs`, update every installed pass in the tenant for each card edit, or rely only on the future external retry cron.
- Reason: One card-owned source prevents preview/pass drift, targeted queueing avoids unnecessary updates to other cards and immediate dispatch matches the current no-cron hosting constraint without coupling configuration success to Apple availability.
- Consequences: Additive migration `0048` must be deployed before card design/location edits update installed passes. Existing passes still require a successful Apple device registration, and failed APNs work remains durable for the protected retry endpoint. Apple owns final rendering; according to current Pass Designer compatibility documentation, store-card logo and strip images may be omitted on iOS 26 or later, so the textual progress field remains mandatory.
- References: [Creating a store card pass](https://developer.apple.com/documentation/walletpasses/creating-a-store-card-pass) and [Creating a pass with Pass Designer](https://developer.apple.com/documentation/walletpasses/creating-a-pass-with-pass-designer).
- Status: Accepted.

## DEC-0029 - Map-Selected Branches And Explicit Strict Geofencing

- Date: 2026-08-20
- Context: Branches required manual latitude/longitude, tenant mode remained `FLEXIBLE`, and every employee purchase/redemption submitted null coordinates. Correct branch coordinates alone therefore could not make geofencing operate.
- Decision: Use Google Places Autocomplete (New) plus Maps JavaScript API as the branch-location picker, persist only formatted address and selected coordinates in the existing schema, and visualize the configured radius. Keep existing tenants flexible until an Admin explicitly enables strict validation. Refuse activation while an active branch lacks coordinates; once strict, prevent active branches from losing coordinates. Capture browser GPS on every confirmation route and retain PostgreSQL triggers as the final inside/outside authority. Treat Apple Wallet proximity as a separate notification feature.
- Alternatives considered: Continue manual coordinates, enable strict mode automatically for every existing tenant, trust a client-side distance calculation, or treat Wallet proximity as operational geofencing.
- Reason: Map selection reduces coordinate errors, explicit activation avoids breaking deployed tenants, and server-side distance enforcement prevents browser tampering while making the previously dormant feature observable.
- Consequences: Deployment requires migration `0050`, HTTPS geolocation and a billing-enabled browser key restricted to exact HTTP referrers with Maps JavaScript API and Places API (New). Without the key, existing coordinates are preserved and the Admin sees a configuration error; no secret or unrestricted server credential is needed in the browser.
- References: [Place Autocomplete Widget](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new), [Load the Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/load-maps-js-api), and [API security best practices](https://developers.google.com/maps/api-security-best-practices).
- Status: Accepted.

## DEC-0028 - Decimal Non-Resetting Lifetime Points

- Date: 2026-08-20
- Context: The configured `LIFETIME_POINTS` type was intentionally paused because the existing balance, purchase, ledger, reward and Wallet paths assumed whole cyclic stamps and reset progress at the highest tier.
- Decision: Store lifetime progress authoritatively in integer tenths alongside the existing whole-unit compatibility columns. For every purchase, calculate `floor(amount_minor * 10 / amount_per_point_minor)`, discard any smaller fraction without carry, never apply a cycle modulo and grant each active reward tier at most once per customer. Customer and employee projections expose the whole part; Admin metrics and purchase exports expose one decimal. Web Card, Apple payload and Admin Wallet previews render accumulated balance plus the next milestone instead of stamp circles. Type changes require explicit Admin confirmation, preserve history/rewards and convert existing whole stamps through the configured multiplier.
- Alternatives considered: Reuse `stamp_balance` with floating-point values, round each purchase, model each decimal as a separate stamp, continue resetting at the highest tier, or keep the type configurable but permanently paused.
- Reason: Integer tenths provide deterministic accounting without floating-point drift, retain backward compatibility for cyclic programs and match the product's different visibility requirements. A separate milestone path avoids applying cancellation and reset assumptions from the cyclic reward engine.
- Consequences: Additive migration `0049` is required before the UI can publish this type. Lifetime purchases, manual reward cancellation and point adjustments are initially definitive and database-blocked. Welcome reward and imported-stamp conversion/milestone generation remain separate follow-up work. Existing Apple installations still require hosted deployment and a successful PassKit refresh to display the new layout.
- Status: Accepted.

## DEC-0030 - History-Safe Admin Lifecycle For Cards And Customers

- Date: 2026-08-24
- Context: Repeated starts of the card wizard could leave multiple same-name draft rows, while the Admin had no explicit way to discard drafts, deactivate published cards or remove clean test customers. Permanent deletion must not erase loyalty, Wallet or audit history, and branch-scoped administrators must not control tenant-wide records.
- Decision: Normalize draft names per tenant, retain the most advanced existing duplicate and make future creation resume it. Model discard and deactivation as reversible archival, with restoration to the prior draft/published state. Permit permanent deletion only from an archived card without issued or operational references, or for a customer without purchases, ledger, rewards, redemptions, adjustments, Wallet installation, balance or accumulated progress. Derive the tenant and require the authenticated `ADMIN` role inside every lifecycle RPC; audit every accepted state change and deletion.
- Alternatives considered: Merge unrelated wizard rows by frontend display only, hard-delete every discarded draft, cascade-delete historical customers/cards, or grant the operations to branch Managers.
- Reason: One canonical draft removes confusing duplicates without losing the most advanced work. Reversible status changes cover normal administration, while guarded deletion supports clean setup/test records without weakening financial, reward, consent or Wallet traceability.
- Consequences: Additive migration `0052` must be deployed before the new actions work or existing duplicate drafts are physically consolidated. Records with history remain deactivatable but intentionally cannot be deleted. Administradores de sucursal receive no lifecycle controls and backend calls return unavailable even if invoked directly.
- Status: Accepted.

## DEC-0031 - Tenant-Bound One-Time Casa Garmendia Import

- Date: 2026-08-24
- Context: Casa Garmendia must migrate one legacy stamp workbook into an already configured non-resetting points card, preserve the supplied non-linear reward equivalences and let imported customers recover the already issued card without creating duplicates. The generic import is Superadmin-only and its old uniform stamp balance does not model this conversion.
- Decision: Add one fixed profile visible only to the active general Admin of the matching tenant. Auto-map the six supplied columns, reject malformed/duplicate/out-of-range rows during preview and convert each 0–15 stamp value to the greatest reached milestone in the supplied table. Confirm in one database transaction against a published lifetime-points card and participating branch, grant Churro individual plus every configured reached tier and enforce one confirmed profile per tenant. Persist the import identifier on each new customer. Public recovery requires exact phone, normalized imported name, same card/branch and privacy consent before redirecting to the claim/terms screen; authorized employees may regenerate that claim QR for an imported card even after an earlier Wallet registration.
- Alternatives considered: Use a uniform stamp multiplier, rewrite the uploaded spreadsheet, expose the generic Superadmin import to all tenant Admins, create a new card on duplicate registration, or reveal an imported card from phone alone without a name match.
- Reason: A named fixed profile represents the real one-off business rule without weakening the generic multi-tenant importer. Database-side card, branch, role, threshold and single-use checks prevent frontend manipulation, while the imported identifier makes recovery explicit and auditable.
- Consequences: Migration `0053` must be deployed after `0052`. The target program must contain active tiers at 100, 200, 300, 400, 500, 650 and 860. The current workbook copies are empty and must be replaced before real confirmation; confirmation cannot be repeated after success.
- Status: Accepted.

## DEC-0032 - Card-Issuance Welcome Reward

- Date: 2026-08-24
- Context: The program schema already stored optional welcome-reward fields, but the multi-card editor did not save them and neither public nor employee registration emitted the configured benefit. The gift must not behave like a points milestone or be duplicated when a card is recovered.
- Decision: Configure the gift in the card editor and grant it from one database trigger after the first `customer_cards` insertion. Mark welcome rewards explicitly and enforce one per customer/card with a partial unique index. Apply optional expiration from the issuance time, leave balances and ledgers unchanged, and make the behavior non-retroactive. Generic imports follow the existing program eligibility option; exclude the Casa Garmendia profile because its transactional importer already grants a fixed welcome Churro.
- Alternatives considered: Grant separately in each registration RPC, model the gift as a zero-point tier, award it during claim/Wallet download, or backfill every existing customer.
- Reason: Card issuance is the common atomic boundary for public and employee registration. A dedicated marker and database uniqueness rule prevent duplicates across retries and recovery without mixing an unconditional benefit into milestone accounting.
- Consequences: Additive migration `0054` is now deployed to hosted production as a targeted repair, although canonical migration history remains unreconciled. Only future issued cards receive the benefit; changing or disabling configuration does not revoke rewards already granted.
- Status: Accepted.

## DEC-0033 - Header-First Apple Pass Identity

- Date: 2026-08-24
- Context: Wallet rendered Casa Garmendia's square logo centered inside the generated 160×50 transparent logo canvas, while a right-side reward header field consumed the remaining width and truncated the tenant name. The barcode alternate text also produced an unwanted caption below the QR.
- Decision: Preserve each source logo's aspect ratio inside Apple's 160×50 maximum and emit a tight output canvas at 1x/2x/3x. Reserve the front header for `logo` plus `logoText`, move the changing reward count to the back and omit optional barcode `altText`. Keep the QR payload unchanged. Queue all installed passes once through the existing card-scoped update outbox after the new generator is deployed.
- Alternatives considered: Shorten the tenant name, remove `logoText`, keep the wide transparent canvas, retain the reward header at the expense of identity width, or encode an empty alternate-text string.
- Reason: Apple owns final pass placement, but eliminating artificial logo padding and nonessential header competition gives its renderer the maximum available width for the business identity. Omitting the optional property is the clean way to remove barcode-adjacent text without affecting scanning.
- Consequences: Migration `0055` must run only after the application deployment, then the protected outbox processor must deliver APNs work. The reward count remains available on the back; existing passes require this queued refresh or a reinstall to receive the new assets and JSON.
- Status: Accepted.

## DEC-0034 - Exact Audited Repair For Casa Garmendia Points

- Date: 2026-08-24
- Context: Casa Garmendia PROD intended to award one lifetime point per MXN $10, but its persisted program rule was MXN $1. Its first and only MXN $2,000 purchase therefore granted 2,000 points, seven milestones and one canje instead of 200 points and two milestones.
- Decision: Apply one production-scoped transaction guarded by the exact tenant, program, customer, purchase, ledger, seven rewards and single redemption inspected immediately beforehand. Change the rule to 1,000 minor units, correct purchase/ledger/balance accounting to 200 points, keep the 100/200 rewards, preserve the 400 canje as a reversed redemption and cancel only rewards above 200. Record a dedicated append-only repair audit and keep the normal cancellation/reversal audits. Clarify the editor as “monto gastado para ganar 1 punto” with a concrete calculation example.
- Alternatives considered: Leave historical 2,000-point accounting, delete the test customer and history, add a negative adjustment while leaving purchase exports wrong, or silently remove generated rewards and the canje.
- Reason: The customer had no other purchase or ledger activity, so the correct state was deterministic. Exact fail-closed guards and one atomic transaction avoid affecting another tenant or overwriting concurrent activity, while reversal and cancellation preserve the operational record.
- Consequences: Hosted production is already corrected and has an Apple Wallet update queued. Migration `0056` is intentionally bound to the production UUID and no-ops elsewhere; it is idempotent only for the exact repaired state. Hosted migration history remains unreconciled, so this targeted repair does not authorize a bulk migration push.
- Status: Accepted.

## DEC-0035 - Header-Safe Apple Reward And Point Progress Fields

- Date: 2026-08-24
- Context: Removing the reward header field fixed Casa Garmendia's truncated identity, but left available rewards only on the back. The Admin preview also drew a CSS point-progress bar that the signed pass never generated, and Apple documents that store-card strip images are not displayed on iOS 26+.
- Decision: Keep the header exclusive to logo and `logoText`. Use no more than Apple's combined limit of four compact secondary/auxiliary fields: customer, available rewards, point progress and next reward. Represent point progress as a five-segment value with the exact current/next milestone, and also generate dynamic 375×144 point-progress strips at 1x/2x/3x for Wallet versions that support them. Retain the full reward count and catalog on the back.
- Alternatives considered: Restore the top-right reward header, rely only on the back, rely only on a strip image, switch the pass away from `storeCard`, or show long milestone sentences that can cause Wallet to hide other front fields.
- Reason: The compact fields preserve header width, meet Apple's four-field limit and remain visible on the user's current iPhone even when Wallet omits strip assets. The optional strip gives older systems a smoother bar without becoming the only representation of progress.
- Consequences: Application code must deploy before migration `0057` queues installed passes. Apple still owns exact truncation and placement, so customer and next-reward values are bounded. A real-device refresh remains required to confirm the final OS rendering.
- References: [Creating a store card pass](https://developer.apple.com/documentation/walletpasses/creating-a-store-card-pass) and [Creating a pass with Pass Designer](https://developer.apple.com/documentation/walletpasses/creating-a-pass-with-pass-designer).
- Status: Accepted.

## DEC-0036 - Per-Card Apple Notification Icon

- Date: 2026-08-24
- Context: Apple Wallet notifications use the pass icon, while the existing card editor only exposed a header logo and strip image. Reusing a wide header asset can make the small notification identity unclear, but changing it must not alter the visible pass header.
- Decision: Store one optional notification icon URL on each loyalty card and expose it in the existing unified design stage. Restrict uploads to the tenant Admin's generated `notification-*` Storage paths and existing raster limits. Generate `icon.png`, `icon@2x.png` and `icon@3x.png` from this source; fall back first to the effective card/tenant logo and then to the bundled safe icon. Keep `logo.png` assets sourced only from the normal header logo. Queue the affected card's installed passes whenever the notification icon changes.
- Alternatives considered: Reuse the header logo unconditionally, replace the visible logo with a square asset, configure one icon tenant-wide, or add a separate Apple-only designer.
- Reason: A dedicated square source gives notifications a legible identity without sacrificing header layout, while the fallback preserves every existing card and the single-stage workflow. Card-scoped storage and update triggers retain multi-tenant isolation and automatic PassKit delivery.
- Consequences: Additive migration `0058` must run before the application build that reads `notification_icon_url` and calls `save_loyalty_card_design_v2`. Existing passes are unchanged until an Admin saves a dedicated icon or another card update occurs. Google Wallet generation remains pending and does not consume this field yet.
- References: [Creating the source for a pass](https://developer.apple.com/documentation/walletpasses/creating-the-source-for-a-pass) and [Creating a pass with Pass Designer](https://developer.apple.com/documentation/walletpasses/creating-a-pass-with-pass-designer).
- Status: Accepted.

## DEC-0037 - Server-Synchronized Google Loyalty Passes

- Date: 2026-09-02
- Context: The shared card model and provider-neutral pass records already existed, but Android customers could only see a conceptual Admin preview. Google Wallet requires issuer-scoped classes/objects, service-account authentication and a signed save link, while public possession of a card token alone must not bypass current terms.
- Decision: Derive one stable loyalty class from each `loyalty_cards` ID and one stable loyalty object from each `customer_cards` ID. Authenticate only on the server with a dedicated service account, upsert the class/object before signing a minimal Save to Google Wallet JWT, and gate the route with the existing published-card, Wallet-enabled and current-terms checks. Reuse the neutral colors/logo/hero, current balance, reward count/catalog, opaque Web Card QR and at most ten card-assigned active proximity locations. Persist the Google object ID in the existing `wallet_passes` table and use Google's official Latin American Spanish badge in customer flows.
- Alternatives considered: Embed complete class/object JSON in every save JWT, expose a browser API key, create separate Android design records, generate random object IDs on every click, skip terms when the opaque token is known, or add another migration solely for initial issuance.
- Reason: Stable resource IDs make retries idempotent and let the add action refresh an existing object rather than duplicate it. A small JWT stays within Google's recommended web-link size, server-only OAuth protects issuer authority, and the shared design prevents Apple/Android card drift.
- Consequences: Deployment requires the Wallet API, numeric Issuer ID, a service account added as a Wallet Console Developer, canonical HTTPS URLs and issuer publishing approval. New issuers remain limited to authorized test accounts in demo mode. Initial issuance and on-demand resynchronization are complete; automatic Google refresh after loyalty operations remains separate rollout work. A paused loyalty program leaves an already-issued card active so its earned rewards remain visible and usable.
- References: [Google Wallet web issuance](https://developers.google.com/wallet/retail/loyalty-cards/web), [JWT claims](https://developers.google.com/wallet/retail/loyalty-cards/use-cases/jwt), [loyalty classes](https://developers.google.com/wallet/reference/rest/v1/loyaltyclass), and [loyalty objects](https://developers.google.com/wallet/reference/rest/v1/loyaltyobject).
- Status: Accepted.

## DEC-0038 - Educational Demo-First Public Landing

- Date: 2026-09-07
- Context: The root route only directed staff to login and did not explain SwiftWallet to a prospective non-technical buyer. Self-service billing and Stripe are not configured.
- Decision: Make `/` an educational Spanish landing that explains the customer journey and business operation before presenting one repeated “Solicitar una demo” conversion. Preserve active-staff and required-password redirects plus a secondary login path. Do not show prices, checkout language or collect lead data until an approved destination and privacy handling exist. Read the demo destination from `NEXT_PUBLIC_DEMO_REQUEST_URL`, with a transparent in-page placeholder when it is absent.
- Alternatives considered: Send every visitor directly to login, present plan pricing before billing exists, add a non-functional lead form or persist public lead data before the privacy notice is approved.
- Reason: A buyer should understand the outcome and day-to-day workflow without technical vocabulary, while the public interface must not imply unavailable commerce or silently collect personal information.
- Consequences: Publication requires an approved scheduling/contact URL. Future lead capture with persisted personal data requires an explicit privacy, retention and abuse-prevention design.
- Status: Accepted.

## DEC-0039 - Purposeful Motion Exception For The Public Landing

- Date: 2026-09-09
- Context: The first educational landing was clear but felt too static to captivate a prospective buyer. The design system normally excludes decorative ambient motion and limits color primarily to actions and state.
- Decision: Accept the user's explicit exception only for the public marketing landing. Use animated solid-color fields and a restrained floating product frame for visual energy, while the primary hero animation must teach the actual compra → progreso → premio workflow through a scan line, sequential stamps and operation confirmations. Reveal later sections once as they enter the viewport. Keep authenticated product areas unchanged, avoid gradients and disable every animation under `prefers-reduced-motion`.
- Alternatives considered: Add a background video, use continuous parallax throughout the page, introduce gradient effects or leave all motion decorative and unrelated to the product.
- Reason: Motion is most valuable when it helps a buyer understand the product while creating a memorable first impression. Scoping it to the landing prevents the operational interface from becoming distracting.
- Consequences: New landing motion must remain performant, must not hide content when JavaScript or `IntersectionObserver` is unavailable and must be rechecked at the four required widths. Any motion expansion into authenticated areas requires a separate explicit decision.
- Status: Accepted.

## DEC-0040 - Editorial Product-Led Marketing Language

- Date: 2026-09-09
- Context: The user supplied a complete landing and component reference under `docs/design/design-system(1)` and explicitly asked for the root landing to follow it and for the resulting system to be documented. The prior landing was educational and animated, but its colorful enterprise-card composition did not match the new editorial, product-led direction.
- Decision: Use the supplied reference as the visual source for the public marketing route while retaining Spanish copy and real product capabilities. Adopt its morrow name and monogram as the product identity, with an editorial warm-white canvas, navy product surfaces and CTAs, restrained teal accents, limited Georgia italic emphasis, tangible operational/wallet/phone previews and slow layered motion. Keep the acquisition flow demo-first, omit pricing and checkout, preserve authenticated redirects and isolate marketing tokens and scale from the operational application.
- Alternatives considered: Copy the Morrow example verbatim, keep the previous multicolor landing, apply the reference only to the hero, or migrate the entire authenticated application to the marketing language.
- Reason: Reusing the reference's composition, identity and design logic makes the intended result concrete, while isolation and semantic token mapping prevent the marketing scale from weakening the denser enterprise console.
- Consequences: `docs/DESIGN_SYSTEM.md` now defines a marketing-specific extension and the route styling lives in `src/app/landing.css`. The reference source under `docs/design/` remains documentation and is excluded from product TypeScript and ESLint validation. Future landing changes must keep the reference, implementation and documented marketing rules synchronized.
- Status: Accepted.

## DEC-0041 - Morrow Product Rebrand

- Date: 2026-09-09
- Context: After reviewing the supplied design reference in the application, the user explicitly selected its “morrow” name and monogram as the product brand rather than keeping the SwiftWallet presentation.
- Decision: Present the product as lowercase `morrow` in marketing, public flows, authenticated navigation, PWA metadata, offline UI, exports and Wallet attribution. Use the navy rounded-square mark with a lowercase italic serif `m`. Retain existing SwiftWallet technical identifiers in database objects, environment variables, cookies, URLs and provider object IDs where renaming creates migration or compatibility risk.
- Alternatives considered: Rebrand only the landing, rename every technical identifier immediately, or keep the former logo next to the new name.
- Reason: A complete user-facing identity avoids a split brand, while leaving stable internal identifiers untouched makes the visual change safe and reversible without affecting sessions, passes or integrations.
- Consequences: New visible product copy and install surfaces use morrow. A future technical namespace migration, domain change or legal trademark review must be planned separately before changing persistent identifiers.
- Status: Accepted.

## DEC-0042 - Local Commercial Authority Before Stripe Fulfillment

- Date: 2026-09-09
- Context: The user authorized starting packages, promotions by membership volume, Stripe billing and affiliates. The repository only had a fictional pricing reference and explicitly lacked billing implementation.
- Decision: Build a provider-neutral commercial domain before Checkout. Define a billable membership as an active issued customer card for an active customer, record both current use and the high-water mark for each subscription period, and use the high-water mark for future limits or volume billing. Keep packages, immutable subscription snapshots, promotion eligibility/redemptions, affiliate attribution/commissions and event idempotency in PostgreSQL. Stripe Product, Price, Customer, Subscription, Coupon, Promotion Code, Invoice and Event identifiers are optional external links; verified server webhooks will be the automated fulfillment authority.
- Alternatives considered: Make Stripe Dashboard the only catalog, count raw customer rows, trust a browser-provided quantity, enforce limits immediately, reuse loyalty rewards as billing promotions, or begin with automatic affiliate payouts.
- Reason: A local contract keeps tenant permissions, historical pricing and promotion rules deterministic, permits manual operation before Stripe credentials exist, and prevents payment-provider availability from corrupting loyalty operations.
- Consequences: Migration `0059` establishes the commercial schema and measurement triggers without blocking new registrations. Checkout, webhook handlers, package/promotion/affiliate UI, grace behavior, tax policy and automated payouts remain separate reviewed units. Stripe usage meters may later receive derived events, but the database remains the reconciliation source.
- References: [Stripe products and prices](https://docs.stripe.com/products-prices/how-products-and-prices-work), [Build a subscriptions integration](https://docs.stripe.com/billing/subscriptions/build-subscriptions), [Usage-based billing](https://docs.stripe.com/billing/subscriptions/usage-based/how-it-works), and [Record usage](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage).
- Status: Accepted.

## DEC-0043 - Independent Reviews Product On Shared Platform Authority

- Date: 2026-09-17
- Context: The user added `docs/reviews_plan.md` for a separately sellable
  reputation product with QR/NFC acquisition, public landing, optional contact
  capture, consumer coupons, analytics and later Google Business Profile and
  Loyalty integration. Its conceptual model used parallel business/product
  names that overlap the existing tenant and commercial domains, and anonymous
  traffic cannot satisfy the current customer's required phone identity.
- Decision: Implement Reviews as Phase 11 behind separate `LOYALTY` and
  `REVIEWS` entitlements while reusing `tenants`, branches, staff/Auth and the
  Phase 10 commercial authority. Keep anonymous review sessions/events outside
  `customers`; link or create a shared tenant customer only with consent and a
  sufficient normalized identity. Keep consumer review offers/coupons separate
  from billing promotions. Source scope comes only from opaque, rotatable
  QR/NFC tokens, and public events are versioned, rate-limited and idempotent.
  Invitations must be neutral and no benefit may depend on posting, changing,
  removing or positively rating a Google review. A Google click is not a
  published review; Google Business Profile synchronization is a separate
  OAuth-backed delivery unit.
- Alternatives considered: Create parallel `businesses`, `business_products`
  and subscriptions; insert every anonymous visit into `customers`; reuse
  billing promotions for customer coupons; infer reviews from outbound clicks;
  or reward customers only after a review or positive rating.
- Reason: Shared platform authority avoids tenant/customer duplication and
  conflicting billing state, while domain separation lets Reviews-only tenants
  operate without Loyalty. Explicit identity, measurement and incentive
  boundaries protect privacy, analytics integrity and Google policy compliance.
- Consequences: Phase 11 starts with a domain/event contract and entitlement
  RLS design. Production PII capture requires approved notice, consent,
  retention and deletion rules. Rating/review data requires Google Business
  Profile access, and combined Loyalty/Reviews automation follows validation of
  the standalone Reviews flow.
- References: `docs/reviews_plan.md`, Google Business Profile Help
  `answer/3474122`, Maps policy `answer/7400114`, and Google Business Profile
  review-data documentation.
- Status: Accepted.

## DEC-0044 - Bounded Per-Card Wallet Image Layout Controls

- Date: 2026-09-17
- Context: The tenant Admin needs to adjust the visible size and surrounding
  space of uploaded images instead of preparing a new source file for every
  card. Apple Wallet fixes the logo and store-card strip regions, and Google
  Wallet independently controls its logo safe area and hero-image crop.
- Decision: Store per-card percentage controls for logo size, logo horizontal
  and vertical margins, main-image size, and main-image horizontal and vertical
  margins. Bound logo size to 50–100%, main-image size to 50–150% and margins to
  0–20%. Apply them to the live Apple preview and compose them server-side into
  the required 1x/2x/3x signed assets without changing provider dimensions.
  Keep defaults at 100% size and zero margins. Explain that Google uses the
  shared source assets but may crop them differently.
- Alternatives considered: Change only the browser preview, allow arbitrary
  pixel dimensions, create separate Apple/Google designers, or require every
  Admin to pre-edit transparent padding into uploaded files.
- Reason: Bounded percentages are responsive, preserve existing cards and map
  to Apple's fixed canvases without presenting unsupported free-form layout as
  portable across providers.
- Consequences: Migration `0062` and application code must deploy together.
  Layout changes queue installed Apple passes and require outbox delivery or a
  pass reinstall before device validation. Google pixel parity is explicitly
  outside the guarantee because its renderer owns the final crop.
- References: Apple Pass Designer image dimensions and Google Wallet loyalty
  card brand guidelines.
- Status: Accepted.
