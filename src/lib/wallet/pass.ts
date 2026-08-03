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
  programName: string;
  stampBalance: number;
  rewardGoal: number | null;
  termsAndConditions: string;
  rewardTiers: Array<{
    stampsRequired: number;
    name: string;
    description: string;
  }>;
};

export function buildWalletPassPayload(input: WalletPassPayload): WalletPassPayload {
  if (!walletProviders.includes(input.provider)) throw new Error("Unsupported wallet provider.");
  if (!input.serialNumber.trim() || !input.cardToken.trim()) throw new Error("Wallet identifiers are required.");
  if (!input.programName.trim() || input.termsAndConditions.trim().length < 10) throw new Error("Wallet program description is required.");
  if (input.rewardTiers.length < 1 || input.rewardTiers.some((tier) => tier.stampsRequired < 1 || !tier.name.trim())) throw new Error("Wallet reward tiers are required.");
  return {
    ...input,
    serialNumber: input.serialNumber.trim(),
    cardToken: input.cardToken.trim(),
    programName: input.programName.trim(),
    termsAndConditions: input.termsAndConditions.trim(),
    rewardTiers: [...input.rewardTiers].sort((left, right) => left.stampsRequired - right.stampsRequired),
  };
}
