# Blockers

## Active Blockers

- **WALLET-001:** Apple Wallet generation requires Apple Developer account, Pass Type ID, Team ID, signing certificate, and certificate password. Google Wallet requires a Google Cloud project, Issuer ID, and service-account credentials. No secrets are present in the repository.
  - **Affected phase:** Phase 8 - Wallet.
  - **Consequence:** Provider-specific pass generation, signing, updates, and device validation cannot be implemented or verified.
  - **Recommendation:** Provide authorized test credentials through the deployment secret manager, never through Git or chat.
  - **Work that can continue:** Web Card fallback, provider-neutral payload tests, documentation, and security review.
  - **Status:** Active.

- **PILOT-001:** No se han proporcionado tenant piloto, aviso de privacidad, propietario operativo, contacto de soporte ni aprobación de producción.
  - **Affected phase:** Phase 9 - Piloto.
  - **Consequence:** No se puede ejecutar ni aprobar el flujo E2E de piloto ni marcar el MVP como listo para producción.
  - **Recommendation:** Proporcionar esos datos y completar el checklist de `docs/PRODUCTION_CHECKLIST.md`.
  - **Work that can continue:** Automated tests, RLS verification, security review, and documentation.
  - **Status:** Active.

## Historical Blockers

### XLSX-001 - Resolved

La dependencia `xlsx@0.18.5` fue agregada con npm. El formato XLSX quedó cubierto por el endpoint de exportaciones y sus pruebas.
