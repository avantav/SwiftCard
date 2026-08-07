import { hexToAppleRgb } from "./design";

export type AppleWalletLocation = {
  latitude: number;
  longitude: number;
  relevantText: string;
};

export type AppleWalletPassData = {
  serialNumber: string;
  tenantName: string;
  brandingMode: "STANDARD" | "WHITE_LABEL";
  logoText: string;
  description: string;
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
  customerName: string;
  programName: string;
  stampBalance: number;
  rewardGoal: number | null;
  availableRewards: number;
  termsAndConditions: string;
  rewardTiers: Array<{
    stampsRequired: number;
    name: string;
    description: string;
  }>;
  cardUrl: string;
  locations: AppleWalletLocation[];
};

export function buildAppleWalletPassProps(
  input: AppleWalletPassData,
  identity: { passTypeIdentifier: string; teamIdentifier: string },
) {
  if (!input.serialNumber.trim() || !input.cardUrl.startsWith("http")) {
    throw new Error("Apple Wallet identifiers are required.");
  }

  const tiers = [...input.rewardTiers].sort(
    (left, right) => left.stampsRequired - right.stampsRequired,
  );
  const rewardCatalog = tiers
    .map(
      (tier) =>
        `${tier.stampsRequired} sellos · ${tier.name}: ${tier.description}`,
    )
    .join("\n");

  return {
    formatVersion: 1 as const,
    passTypeIdentifier: identity.passTypeIdentifier,
    teamIdentifier: identity.teamIdentifier,
    serialNumber: input.serialNumber,
    organizationName: input.tenantName,
    description: input.description,
    logoText: input.logoText,
    backgroundColor: hexToAppleRgb(input.backgroundColor),
    foregroundColor: hexToAppleRgb(input.foregroundColor),
    labelColor: hexToAppleRgb(input.labelColor),
    barcodes: [
      {
        format: "PKBarcodeFormatQR" as const,
        message: input.cardUrl,
        messageEncoding: "iso-8859-1",
        altText: `Tarjeta de ${input.tenantName}`,
      },
    ],
    locations: input.locations.slice(0, 10),
    storeCard: {
      headerFields: [
        {
          key: "available-rewards",
          label: "PREMIOS",
          value: input.availableRewards,
          changeMessage: "Ahora tienes %@ premios disponibles.",
        },
      ],
      primaryFields: [
        {
          key: "stamp-balance",
          label: "SELLOS",
          value: input.stampBalance,
          changeMessage: "Ahora tienes %@ sellos.",
        },
      ],
      secondaryFields: [
        { key: "customer", label: "CLIENTE", value: input.customerName },
      ],
      auxiliaryFields: input.rewardGoal
        ? [{ key: "goal", label: "META", value: `${input.rewardGoal} sellos` }]
        : [],
      backFields: [
        { key: "program", label: "PROGRAMA", value: input.programName },
        {
          key: "reward-tiers",
          label: "PREMIOS POR SELLOS",
          value: rewardCatalog || "Consulta los premios vigentes con el negocio.",
        },
        {
          key: "terms",
          label: "TÉRMINOS Y CONDICIONES",
          value: input.termsAndConditions,
        },
        {
          key: "web-card",
          label: "TARJETA WEB",
          value: input.cardUrl,
          dataDetectorTypes: ["PKDataDetectorTypeLink" as const],
        },
        ...(input.brandingMode === "WHITE_LABEL"
          ? []
          : [
              {
                key: "powered-by",
                label: "PLATAFORMA",
                value: "Powered by SwiftWallet",
              },
            ]),
      ],
    },
  };
}
