# Blockers

## Active Blockers

- **WALLET-001:** Initial Apple Wallet generation was accepted on a real iPhone. The automatic-update code, migration `0038`, PassKit endpoints, encrypted registrations, transactional outbox, immediate APNs sender and protected retry endpoint are implemented and locally validated. Applying `0038`, deploying the stable update secret, reinstalling the pass, validating production APNs end to end, connecting an external retry cron and adding Google Wallet remain pending. No secrets are present in the repository.
  - **Affected phase:** Phase 8 - Wallet.
  - **Consequence:** The implementation is ready for configuration but installed passes will not update until `0038` and the new pass metadata are deployed; failed immediate pushes can remain queued without an external scheduler.
  - **Recommendation:** Apply `0038`, configure `APPLE_WALLET_UPDATE_SECRET_BASE64`, redeploy, reinstall the pass, validate one stamp and reward update, then schedule the protected retry endpoint.
  - **Work that can continue:** Implement Google Wallet and the remaining administrative correction UI without committing secrets.
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
