import "server-only";

import type { WalletProvider } from "./pass";

export function walletProviderConfig(provider: WalletProvider) {
  if (provider === "APPLE") {
    const required = [
      "APPLE_PASS_TYPE_ID",
      "APPLE_TEAM_ID",
      "APPLE_SIGNER_CERTIFICATE_BASE64",
      "APPLE_SIGNER_KEY_BASE64",
      "APPLE_WWDR_CERTIFICATE_BASE64",
    ] as const;
    const missing = required.filter((name) => !process.env[name]?.trim());
    return { configured: missing.length === 0, missing };
  }
  return { configured: Boolean(process.env.GOOGLE_WALLET_ISSUER_ID && process.env.GOOGLE_WALLET_SERVICE_ACCOUNT) };
}
