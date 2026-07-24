import "server-only";

import type { WalletProvider } from "./pass";

export function walletProviderConfig(provider: WalletProvider) {
  if (provider === "APPLE") return { configured: Boolean(process.env.APPLE_PASS_TYPE_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_CERTIFICATE) };
  return { configured: Boolean(process.env.GOOGLE_WALLET_ISSUER_ID && process.env.GOOGLE_WALLET_SERVICE_ACCOUNT) };
}
