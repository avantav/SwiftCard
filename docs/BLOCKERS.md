# Blockers

## Active Blockers

- **MIGRATIONS-001:** Hosted Supabase migration history currently records only through `0034`, although later schema objects were applied manually and targeted `0051`/`0054`/`0056` changes are live; canonical history through local migration `0057` is not reconciled.
  - **Affected area:** Repeatable remote database deployment.
  - **Consequence:** The bulk migration runner would try to replay migrations `0035` onward and may stop on objects that already exist.
  - **Recommendation:** Reconcile each hosted schema change against migrations `0035` through `0057`, then repair canonical migration history before using `npm run db:push:remote`. Deploy the new application code before applying `0057`, because that migration queues installed passes to fetch the new progress layout.

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

- **WALLET-001:** Initial Apple Wallet generation and the applied `0039` repair work in production. The real device now shows the compact header/QR layout, while the restored front reward count and iOS-26-compatible point progress through local migration `0057` still require deployment and refresh; APNs retry cron and Google Wallet also remain pending. No secrets are present in the repository.
  - **Affected phase:** Phase 8 - Wallet.
  - **Consequence:** Until `0057` is deployed and processed, the current pass can show its corrected point balance without a front reward count or visible milestone bar; failed pushes can remain queued without an external scheduler.
  - **Recommendation:** Deploy application code first, apply the targeted `0057` refresh only after reconciling its prerequisites, invoke the protected update processor, confirm `PREMIOS` and point progress on iPhone, then schedule the retry endpoint.
  - **Work that can continue:** Implement Google Wallet and the remaining administrative correction UI without committing secrets.

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
