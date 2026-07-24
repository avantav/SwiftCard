# Blockers

## Active Blockers

- **WALLET-001:** Apple Wallet generation requires Apple Developer account, Pass Type ID, Team ID, signing certificate, and certificate password. Google Wallet requires a Google Cloud project, Issuer ID, and service-account credentials. No secrets are present in the repository.
  - **Affected phase:** Phase 8 - Wallet.
  - **Consequence:** Provider-specific pass generation, signing, updates, and device validation cannot be implemented or verified.
  - **Recommendation:** Provide authorized test credentials through the deployment secret manager, never through Git or chat.
  - **Work that can continue:** Web Card fallback, provider-neutral payload tests, documentation, and security review.
  - **Status:** Active.

## Historical Blockers

### XLSX-001 - Resolved

La dependencia `xlsx@0.18.5` fue agregada con npm. El formato XLSX quedó cubierto por el endpoint de exportaciones y sus pruebas.
