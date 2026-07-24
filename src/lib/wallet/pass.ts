export const walletProviders = ["APPLE", "GOOGLE"] as const;
export type WalletProvider = (typeof walletProviders)[number];

export type WalletPassPayload = {
  provider: WalletProvider;
  serialNumber: string;
  tenantName: string;
  brandingMode: "STANDARD" | "WHITE_LABEL";
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  customerName: string;
  cardToken: string;
  stampBalance: number;
  rewardGoal: number | null;
};

export function buildWalletPassPayload(input: WalletPassPayload): WalletPassPayload {
  if (!walletProviders.includes(input.provider)) throw new Error("Unsupported wallet provider.");
  if (!input.serialNumber.trim() || !input.cardToken.trim()) throw new Error("Wallet identifiers are required.");
  return { ...input, serialNumber: input.serialNumber.trim(), cardToken: input.cardToken.trim() };
}
