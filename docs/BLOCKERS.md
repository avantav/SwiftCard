# Blockers

## Active Blockers

- **WALLET-001:** Initial Apple Wallet generation and the applied `0039` repair work in production. The visible QR and employee camera corrections are implemented and locally validated; deployment, pass refresh/reinstallation, real-device scan, APNs validation, an external retry cron and Google Wallet remain pending. No secrets are present in the repository.
  - **Affected phase:** Phase 8 - Wallet.
  - **Consequence:** The current deployed pass may still omit the visible QR, and failed immediate pushes can remain queued without an external scheduler.
  - **Recommendation:** Deploy the QR correction, refresh or reinstall the pass, scan it from the employee PWA, validate one stamp and reward update, then schedule the protected retry endpoint.
  - **Work that can continue:** Implement Google Wallet and the remaining administrative correction UI without committing secrets.

- **PILOT-001:** No se han proporcionado tenant piloto, aviso de privacidad, propietario operativo, contacto de soporte ni aprobación de producción.
  - **Affected phase:** Phase 9 - Piloto.
  - **Consequence:** No se puede ejecutar ni aprobar el flujo E2E de piloto ni marcar el MVP como listo para producción.
  - **Recommendation:** Proporcionar esos datos y completar el checklist de `docs/PRODUCTION_CHECKLIST.md`.
  - **Work that can continue:** Automated tests, RLS verification, security review, and documentation.
  - **Status:** Active.

## Historical Blockers

### MULTICARD-001 - Resolved locally

Migrations `0043` through `0047`, their backfill/projections/terms acceptance/Wallet delivery state, the focused SQL scenarios and the complete historical migration/RLS harness pass in disposable PostgreSQL. Hosted deployment and real-device smoke testing remain release activities, not a local implementation blocker.

### XLSX-001 - Resolved

La dependencia `xlsx@0.18.5` fue agregada con npm. El formato XLSX quedó cubierto por el endpoint de exportaciones y sus pruebas.
