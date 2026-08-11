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
      "APPLE_WALLET_UPDATE_SECRET_BASE64",
    ] as const;
    const missing = required.filter((name) => {
      const value = process.env[name]?.trim();
      if (!value) return true;
      if (name !== "APPLE_WALLET_UPDATE_SECRET_BASE64") return false;
      return !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || Buffer.from(value, "base64").length !== 32;
    });
    return { configured: missing.length === 0, missing };
  }
  return { configured: Boolean(process.env.GOOGLE_WALLET_ISSUER_ID && process.env.GOOGLE_WALLET_SERVICE_ACCOUNT) };
}
