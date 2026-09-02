export type GoogleWalletPassData = {
  issuerId: string;
  loyaltyCardId: string;
  customerCardId: string;
  tenantName: string;
  programName: string;
  customerName: string;
  unitNameSingular: string;
  unitNamePlural: string;
  balance: number;
  availableRewards: number;
  rewardGoal: number | null;
  rewardTiers: Array<{
    stampsRequired: number;
    name: string;
    description: string;
  }>;
  termsAndConditions: string;
  backgroundColor: string;
  logoUrl: string;
  heroImageUrl: string | null;
  cardUrl: string;
  active: boolean;
  merchantLocations: Array<{ latitude: number; longitude: number }>;
};

export type GoogleWalletImage = {
  sourceUri: { uri: string };
  contentDescription: {
    defaultValue: { language: "es-MX"; value: string };
  };
};

function bounded(value: string, maximum: number, fallback: string) {
  const normalized = value.trim() || fallback;
  return normalized.length <= maximum
    ? normalized
    : `${normalized.slice(0, Math.max(1, maximum - 1)).trimEnd()}…`;
}

function identifierSuffix(prefix: string, value: string) {
  const normalized = value.replace(/[^A-Za-z0-9_-]/g, "");
  if (!normalized) throw new Error("Google Wallet identifier is required.");
  return `${prefix}_${normalized}`;
}

function walletImage(uri: string, description: string): GoogleWalletImage {
  if (!uri.startsWith("https://")) {
    throw new Error("Google Wallet images require HTTPS.");
  }
  return {
    sourceUri: { uri },
    contentDescription: {
      defaultValue: {
        language: "es-MX",
        value: bounded(description, 80, "Imagen de la tarjeta"),
      },
    },
  };
}

export function googleWalletResourceIds(
  issuerId: string,
  loyaltyCardId: string,
  customerCardId: string,
) {
  if (!/^\d{6,32}$/.test(issuerId)) {
    throw new Error("Invalid Google Wallet issuer ID.");
  }
  return {
    classId: `${issuerId}.${identifierSuffix("swiftwallet_card", loyaltyCardId)}`,
    objectId: `${issuerId}.${identifierSuffix("swiftwallet_customer", customerCardId)}`,
  };
}

export function buildGoogleWalletResources(input: GoogleWalletPassData) {
  if (
    !Number.isSafeInteger(input.balance) ||
    input.balance < 0 ||
    !Number.isSafeInteger(input.availableRewards) ||
    input.availableRewards < 0 ||
    !/^#[0-9A-Fa-f]{6}$/.test(input.backgroundColor) ||
    !input.cardUrl.startsWith("https://")
  ) {
    throw new Error("Invalid Google Wallet pass data.");
  }

  const ids = googleWalletResourceIds(
    input.issuerId,
    input.loyaltyCardId,
    input.customerCardId,
  );
  const tiers = [...input.rewardTiers].sort(
    (left, right) => left.stampsRequired - right.stampsRequired,
  );
  const nextTier = tiers.find((tier) => tier.stampsRequired > input.balance);
  const progress = nextTier
    ? `Faltan ${Math.max(1, nextTier.stampsRequired - input.balance)} ${input.unitNamePlural} para ${nextTier.name}.`
    : tiers.length
      ? `Todos los premios disponibles fueron desbloqueados. Sigue acumulando ${input.unitNamePlural}.`
      : `Consulta los premios vigentes con ${input.tenantName}.`;
  const catalog = tiers.length
    ? tiers
      .map((tier) => `${tier.stampsRequired} ${tier.stampsRequired === 1 ? input.unitNameSingular : input.unitNamePlural}: ${tier.name}`)
      .join("\n")
    : "Consulta los premios vigentes con el negocio.";

  const loyaltyClass = {
    id: ids.classId,
    issuerName: bounded(input.tenantName, 20, "SwiftWallet"),
    programName: bounded(input.programName, 20, "Programa de fidelidad"),
    reviewStatus: "UNDER_REVIEW",
    programLogo: walletImage(input.logoUrl, `Logo de ${input.tenantName}`),
    accountNameLabel: "Cliente",
    accountIdLabel: "Tarjeta",
    hexBackgroundColor: input.backgroundColor.toUpperCase(),
    homepageUri: {
      uri: input.cardUrl,
      description: "Abrir tarjeta digital",
    },
  };

  const loyaltyObject = {
    id: ids.objectId,
    classId: ids.classId,
    state: input.active ? "ACTIVE" : "INACTIVE",
    accountName: bounded(input.customerName, 20, "Cliente"),
    accountId: bounded(input.customerCardId.replaceAll("-", ""), 20, "Tarjeta"),
    loyaltyPoints: {
      label: bounded(input.unitNamePlural, 9, "Puntos"),
      balance: { int: input.balance },
    },
    secondaryLoyaltyPoints: {
      label: "Premios",
      balance: { int: input.availableRewards },
    },
    barcode: {
      type: "QR_CODE",
      value: input.cardUrl,
      alternateText: "Presenta este código al personal",
    },
    textModulesData: [
      { id: "progress", header: "Próximo premio", body: progress },
      {
        id: "program-details",
        header: "Premios y condiciones",
        body: `${catalog}\n\n${input.termsAndConditions}`,
      },
    ],
    linksModuleData: {
      uris: [
        {
          id: "web-card",
          uri: input.cardUrl,
          description: "Abrir tarjeta digital",
        },
      ],
    },
    merchantLocations: input.merchantLocations.slice(0, 10),
    ...(input.heroImageUrl
      ? {
          heroImage: walletImage(
            input.heroImageUrl,
            `Imagen principal de ${input.programName}`,
          ),
        }
      : {}),
  };

  return { ...ids, loyaltyClass, loyaltyObject };
}
