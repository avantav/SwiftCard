# Blockers

## Active Blockers

- **WALLET-001:** Initial Apple Wallet generation and tenant design are implemented, but real signing/device validation and the update service require an Apple Developer account, Pass Type ID, Team ID, signer certificate, private key, WWDR certificate, and optional key password. Google Wallet requires a Google Cloud project, Issuer ID, and service-account credentials. No secrets are present in the repository.
  - **Affected phase:** Phase 8 - Wallet.
  - **Consequence:** The `.pkpass` package path is code-complete and locally signature-tested with disposable certificates, but it cannot be accepted by Apple devices or validated end to end; registrations, APNs updates, Google passes, and official Wallet badge installation remain pending.
  - **Recommendation:** Provide authorized test credentials through the deployment secret manager, never through Git or chat.
  - **Work that can continue:** Apply migration `0036`, configure tenant designs, finish the Apple update web service, and implement Google Wallet without committing secrets.
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
