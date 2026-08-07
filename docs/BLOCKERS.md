# Blockers

## Active Blockers

- **WALLET-001:** Initial Apple Wallet generation, tenant design, Storage uploads, and local signing are implemented. Authorized Apple credentials are configured only in the ignored local environment and generate a signed `.pkpass`; real-device acceptance, production secret deployment, the update service, and Google Wallet credentials remain pending. No secrets are present in the repository.
  - **Affected phase:** Phase 8 - Wallet.
  - **Consequence:** Cryptographic signing is locally verified, but Apple-device acceptance and the production download path remain unconfirmed; registrations, APNs updates, Google passes, and official Wallet badge installation remain pending.
  - **Recommendation:** Apply migrations `0036` and `0037` with release approval, copy credentials through the deployment secret manager, and validate on a real Apple device without exposing secrets.
  - **Work that can continue:** Finish the Apple update web service and implement Google Wallet without committing secrets.
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
