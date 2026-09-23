import { hexToAppleRgb } from "./design";
import {
  appleWalletPointProgressText,
  appleWalletProgressText,
  appleWalletRewardTierText,
} from "./apple-card-content";

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
  programType: "STAMPS_PER_PURCHASE" | "STAMPS_PER_AMOUNT" | "LIFETIME_POINTS";
  unitNameSingular: string;
  unitNamePlural: string;
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
  webServiceUrl: string;
  authenticationToken: string;
  voided?: boolean;
  locations: AppleWalletLocation[];
};

export function buildAppleWalletPassProps(
  input: AppleWalletPassData,
  identity: { passTypeIdentifier: string; teamIdentifier: string },
) {
  if (
    !input.serialNumber.trim() ||
    !input.cardUrl.startsWith("https://") ||
    !input.webServiceUrl.startsWith("https://") ||
    input.authenticationToken.length < 32
  ) {
    throw new Error("Apple Wallet identifiers are required.");
  }

  const tiers = [...input.rewardTiers].sort(
    (left, right) => left.stampsRequired - right.stampsRequired,
  );
  const rewardCatalog = tiers
    .map(
      (tier) => appleWalletRewardTierText({
        required: tier.stampsRequired,
        name: tier.name,
        description: tier.description,
        unitNamePlural: input.unitNamePlural,
      }),
    )
    .join("\n");
  const lifetimePoints = input.programType === "LIFETIME_POINTS";
  const nextTier = lifetimePoints
    ? tiers.find((tier) => tier.stampsRequired > input.stampBalance)
    : null;
  const lastTier = tiers.at(-1) ?? null;
  const pointProgressGoal = nextTier?.stampsRequired ?? lastTier?.stampsRequired ?? input.rewardGoal;
  const pointProgressText = appleWalletPointProgressText({
    balance: input.stampBalance,
    goal: nextTier ? pointProgressGoal : null,
    complete: !nextTier && Boolean(lastTier),
  });
  const nextMilestoneText = nextTier
    ? nextTier.name.length > 18
      ? `${nextTier.name.slice(0, 17).trimEnd()}…`
      : nextTier.name
    : "Todos desbloqueados";

  return {
    formatVersion: 1 as const,
    passTypeIdentifier: identity.passTypeIdentifier,
    teamIdentifier: identity.teamIdentifier,
    serialNumber: input.serialNumber,
    webServiceURL: input.webServiceUrl.replace(/\/$/, ""),
    authenticationToken: input.authenticationToken,
    organizationName: input.tenantName,
    description: input.description,
    voided: input.voided ?? false,
    ...(input.logoText.trim() ? { logoText: input.logoText.trim() } : {}),
    backgroundColor: hexToAppleRgb(input.backgroundColor),
    foregroundColor: hexToAppleRgb(input.foregroundColor),
    labelColor: hexToAppleRgb(input.labelColor),
    barcodes: [
      {
        format: "PKBarcodeFormatQR" as const,
        message: input.cardUrl,
        messageEncoding: "iso-8859-1",
      },
    ],
    locations: input.locations.slice(0, 10),
    storeCard: {
      headerFields: [],
      primaryFields: lifetimePoints
        ? [{
            key: "points-balance",
            label: input.unitNamePlural.toLocaleUpperCase("es-MX"),
            value: input.stampBalance,
            changeMessage: `Ahora tienes %@ ${input.unitNamePlural}.`,
          }]
        : [],
      secondaryFields: [
        {
          key: "customer",
          label: "CLIENTE",
          value: input.customerName.length > 16
            ? `${input.customerName.slice(0, 15).trimEnd()}…`
            : input.customerName,
        },
        {
          key: "available-rewards-front",
          label: "PREMIOS",
          value: input.availableRewards,
          changeMessage: "Ahora tienes %@ premios disponibles.",
        },
      ],
      auxiliaryFields: lifetimePoints
        ? [
          {
            key: "point-progress",
            label: "PROGRESO",
            value: pointProgressText,
            changeMessage: "Tu progreso ahora es %@.",
          },
          {
            key: "next-milestone",
            label: nextTier ? "SIGUIENTE" : "PROGRAMA",
            value: nextMilestoneText,
          },
        ]
        : [{
          key: "stamp-progress",
          label: "PROGRESO",
          value: appleWalletProgressText({
            balance: input.stampBalance,
            goal: input.rewardGoal,
            unitNameSingular: input.unitNameSingular,
            unitNamePlural: input.unitNamePlural,
          }),
          changeMessage: "Tu tarjeta ahora tiene %@.",
        }],
      backFields: [
        { key: "program", label: "PROGRAMA", value: input.programName },
        {
          key: "reward-tiers",
          label: `PREMIOS POR ${input.unitNamePlural.toLocaleUpperCase("es-MX")}`,
          value: rewardCatalog || "Consulta los premios vigentes con el negocio.",
        },
        {
          key: "available-rewards",
          label: "PREMIOS DISPONIBLES",
          value: input.availableRewards,
          changeMessage: "Ahora tienes %@ premios disponibles.",
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
                value: "Powered by morrow",
              },
            ]),
      ],
    },
  };
}
