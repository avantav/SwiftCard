# Google Wallet Deployment

SwiftWallet can issue Google Wallet loyalty passes without another database migration. The public action remains hidden until both Google environment values are present, the card is published with Wallet enabled and the current program terms have been accepted.

## Google setup

1. Create or select the production Google Cloud project and enable the Google Wallet API.
2. Create the issuer account in Google Pay & Wallet Console and copy its numeric Issuer ID.
3. Create a dedicated service account in the same Cloud project and download its JSON key once.
4. In Google Pay & Wallet Console, invite the service-account email with the **Developer** role. Cloud IAM permissions alone do not grant Wallet issuer access.
5. New issuer accounts begin in demo mode. Add the Android test account through the Console, validate the pass and request publishing access before a public rollout.

Official references: [authentication](https://developers.google.com/wallet/retail/loyalty-cards/getting-started/auth/rest), [issuer onboarding](https://developers.google.com/wallet/retail/loyalty-cards/getting-started/issuer-onboarding), and [web issuance](https://developers.google.com/wallet/retail/loyalty-cards/web).

## Server-only environment

Set these in the deployment secret manager, never in a browser-prefixed variable and never in Git:

```dotenv
GOOGLE_WALLET_ISSUER_ID=3388000000000000000
GOOGLE_WALLET_SERVICE_ACCOUNT=<complete JSON encoded as Base64>
SWIFTWALLET_PUBLIC_URL=https://wallet.example.com
```

`GOOGLE_WALLET_SERVICE_ACCOUNT` accepts either complete single-line JSON with escaped PEM newlines or Base64 of the complete JSON file. Base64 avoids multiline parsing problems in hosting dashboards; it is encoding, not encryption, so the value must still be stored as a secret. `SWIFTWALLET_PUBLIC_URL` must be the canonical public HTTPS origin because Google fetches pass imagery and the QR opens the Web Card.

After adding or rotating an environment value, redeploy the application. Do not expose the service account to `NEXT_PUBLIC_*`, logs, screenshots or support messages.

## Runtime flow

- One loyalty class is derived from each published SwiftWallet card configuration.
- One loyalty object is derived from each issued customer card.
- The server upserts both resources through the Google Wallet REST API, then signs a short Save to Google Wallet JWT that references the existing object.
- The object contains the current balance, available-reward count, ordered reward catalog, terms, opaque Web Card QR, shared card imagery and at most ten active proximity locations.
- SwiftWallet records the Google object ID in `wallet_passes`; failures expose only a generic customer message.

The current implementation synchronizes the object whenever the customer uses the Google Wallet add action. Automatic post-purchase Google refresh is separate from this initial issuance path and remains release follow-up work. Google controls exact rendering and whether a proximity suggestion appears.

## Smoke test

1. Confirm the target card is `PUBLISHED` and **Habilitar Wallet** is on.
2. Register a disposable customer or open an existing claim QR.
3. Accept the current terms and choose the official **Agregar a la Billetera de Google** action.
4. In demo mode, sign in on Android with an account authorized in Wallet Console.
5. Confirm tenant/program identity, customer, balance, reward count, QR, details and locations.
6. Scan the QR from the employee flow and confirm it resolves the correct card.
7. Change the balance, use the add action again and confirm the existing object is updated rather than duplicated.

Never use real customer data for issuer-review screenshots unless consent and retention handling are approved.
