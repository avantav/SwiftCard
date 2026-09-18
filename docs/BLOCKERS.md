# Blockers

## Active Blockers

- **REVIEWS-001:** The Reviews product is authorized and its standalone MVP can
  begin at domain-contract level, but privacy and external-integration inputs
  are not approved.
  - **Affected area:** Phase 11 contact capture, analytics retention and Google
    Business Profile synchronization.
  - **Consequence:** No production PII collection or Google review/rating sync
    can be released yet.
  - **Recommendation:** Approve the privacy notice, consent text,
    retention/deletion periods, bot/rate limits and customer-benefit terms;
    later provide Google Business Profile OAuth approval and confirm location
    ownership for participating tenants.
  - **Work that can continue:** Versioned domain/event design, entitlement
    model, RLS plan and non-PII link-out architecture.

- **LANDING-001:** The product owner has not provided the destination for “Solicitar una demo”.
  - **Affected area:** Public landing conversion.
  - **Consequence:** The complete educational page can be reviewed locally, but its demo actions must not be published as a working lead channel yet.
  - **Recommendation:** Provide an approved Calendly, WhatsApp, email or form URL and set it as `NEXT_PUBLIC_DEMO_REQUEST_URL` in the deployment environment.
  - **Work that can continue:** Copy review, SEO refinement and all application functionality; no visitor data is collected by the placeholder.

- **MIGRATIONS-001:** Hosted Supabase migration history currently records only through `0034`, although later schema objects were applied manually and targeted `0051`/`0054`/`0056` changes are live; canonical history through local migration `0058` is not reconciled.
  - **Affected area:** Repeatable remote database deployment.
  - **Consequence:** The bulk migration runner would try to replay migrations `0035` onward and may stop on objects that already exist.
  - **Recommendation:** Reconcile each hosted schema change against migrations `0035` through `0058`, then repair canonical migration history before using `npm run db:push:remote`. Deploy the progress generator before applying `0057`; apply additive schema migration `0058` before deploying the editor code that reads its new column and RPC.

- **IMPORT-001:** The three Casa Garmendia `.xlsx` files currently present in `/home/advanta/Downloads` are empty (0 bytes); only the screenshot exposes the expected headers.
  - **Affected area:** Real-data preview and execution of the one-time Casa Garmendia import.
  - **Consequence:** Code, mapping and conversion can be validated with fixtures, but the actual customer rows cannot be inspected or imported yet.
  - **Recommendation:** Obtain the original non-empty workbook, keep the six expected headers, run the Admin preview and resolve every reported row before the irreversible confirmation.
  - **Work that can continue:** Application deployment, migration validation and test-data smoke paths.
  - **Work that can continue:** Application deployment and targeted, reviewed database fixes; do not run the bulk migration command meanwhile.

- **MAPS-001:** The Google Maps branch picker is implemented, but neither `.env.local` nor the documented hosted configuration currently provides `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
  - **Affected area:** Admin branch location search and map selection.
  - **Consequence:** The UI preserves existing coordinates and explains the missing configuration, but cannot load Places suggestions or map tiles until a key is supplied.
  - **Recommendation:** In Google Cloud enable Maps JavaScript API and Places API (New), attach billing, restrict a browser key to the exact local/production HTTP referrers, set the environment variable and redeploy.
  - **Work that can continue:** Migration deployment, branch data review and all non-map functionality.

- **WALLET-001:** Apple and Google Wallet issuance are implemented without secrets in the repository. Google still needs a configured issuer, a service account registered as a Wallet Console Developer, publishing access and a real Android save test. The restored Apple reward progress through `0057`, notification icon through `0058` and APNs retry cron also still require rollout validation.
  - **Affected phase:** Phase 8 - Wallet.
  - **Consequence:** Google actions remain hidden until both environment values exist, and new issuers in demo mode can save only with authorized Admin/Developer/test accounts. Until `0057` is deployed and processed, the current Apple pass can also omit its front reward count/progress; failed Apple pushes can remain queued without a scheduler.
  - **Recommendation:** Complete `docs/GOOGLE_WALLET.md`, validate one test save, request publishing access and then test a normal customer account. Separately deploy/process the Apple refresh and schedule its retry endpoint.
  - **Work that can continue:** Deployment preparation and remaining administrative correction UI.

- **PILOT-001:** No se han proporcionado tenant piloto, aviso de privacidad, propietario operativo, contacto de soporte ni aprobación de producción.
  - **Affected phase:** Phase 9 - Piloto.
  - **Consequence:** No se puede ejecutar ni aprobar el flujo E2E de piloto ni marcar el MVP como listo para producción.
  - **Recommendation:** Proporcionar esos datos y completar el checklist de `docs/PRODUCTION_CHECKLIST.md`.
  - **Work that can continue:** Automated tests, RLS verification, security review, and documentation.
  - **Status:** Active.

## Historical Blockers

### MULTICARD-001 - Resolved locally

Migrations `0043` through `0049`, including the lifetime-points engine and projections, their focused SQL scenarios and the complete historical migration/RLS harness pass in disposable PostgreSQL. Hosted deployment and real-device smoke testing remain release activities, not a local implementation blocker.

### XLSX-001 - Resolved

La dependencia `xlsx@0.18.5` fue agregada con npm. El formato XLSX quedó cubierto por el endpoint de exportaciones y sus pruebas.
