export const loyaltyProgramStatuses = ["ACTIVE", "PAUSED"] as const;
export const loyaltyRuleTypes = ["PER_PURCHASE", "PER_AMOUNT"] as const;

export type LoyaltyProgramStatus = (typeof loyaltyProgramStatuses)[number];
export type LoyaltyRuleType = (typeof loyaltyRuleTypes)[number];

export type RewardTierInput = {
  stampsRequired: number;
  name: string;
  description: string;
  expirationDays: number | null;
};

export type LoyaltyProgramInput = {
  programId: string | null;
  name: string;
  status: LoyaltyProgramStatus;
  ruleType: LoyaltyRuleType;
  minimumPurchaseMinor: number;
  stampsPerPurchase: number;
  amountPerStampMinor: number | null;
  carryRemainder: boolean;
  termsAndConditions: string;
  rewardTiers: RewardTierInput[];
};

export type LoyaltyProgramValidationResult =
  | { ok: true; data: LoyaltyProgramInput }
  | { ok: false; errors: string[] };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function texts(formData: FormData, field: string) {
  return formData
    .getAll(field)
    .map((value) => (typeof value === "string" ? value.trim() : ""));
}

export function getCurrencyFractionDigits(currencyCode: string): number {
  try {
    return (
      new Intl.NumberFormat("en", {
        style: "currency",
        currency: currencyCode,
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

function parseMoneyToMinorUnits(
  rawValue: string,
  fractionDigits: number,
  label: string,
  allowZero: boolean,
  errors: string[],
) {
  if (rawValue.length > 24) {
    errors.push(`${label} es demasiado grande.`);
    return null;
  }

  const pattern =
    fractionDigits === 0
      ? /^\d+$/
      : new RegExp(`^\\d+(?:\\.\\d{1,${fractionDigits}})?$`);

  if (!pattern.test(rawValue)) {
    errors.push(
      `${label} debe ser un importe válido con máximo ${fractionDigits} decimales.`,
    );
    return null;
  }

  const [wholePart, decimalPart = ""] = rawValue.split(".");
  const scale = BigInt(10) ** BigInt(fractionDigits);
  const minorUnits =
    BigInt(wholePart) * scale +
    BigInt(decimalPart.padEnd(fractionDigits, "0") || "0");

  if (
    minorUnits > BigInt(Number.MAX_SAFE_INTEGER) ||
    (!allowZero && minorUnits === BigInt(0))
  ) {
    errors.push(
      allowZero
        ? `${label} es demasiado grande.`
        : `${label} debe ser mayor que cero.`,
    );
    return null;
  }

  return Number(minorUnits);
}

function parseBoundedInteger(
  rawValue: string,
  label: string,
  min: number,
  max: number,
  errors: string[],
) {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    errors.push(`${label} debe ser un entero entre ${min} y ${max}.`);
    return null;
  }
  return parsed;
}

export function formatMinorUnitsForInput(
  minorUnits: number | string,
  currencyCode: string,
) {
  const fractionDigits = getCurrencyFractionDigits(currencyCode);
  const value = BigInt(String(minorUnits));

  if (fractionDigits === 0) {
    return value.toString();
  }

  const scale = BigInt(10) ** BigInt(fractionDigits);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(fractionDigits, "0");
  return `${whole}.${fraction}`;
}

export function validateLoyaltyProgramForm(
  formData: FormData,
  currencyCode: string,
): LoyaltyProgramValidationResult {
  const errors: string[] = [];
  const rawProgramId = text(formData, "programId");
  const name = text(formData, "name");
  const status = text(formData, "status");
  const ruleType = text(formData, "ruleType");
  const termsAndConditions = text(formData, "termsAndConditions");
  const fractionDigits = getCurrencyFractionDigits(currencyCode);

  if (rawProgramId && !uuidPattern.test(rawProgramId)) {
    errors.push("El identificador del programa no es válido.");
  }

  if (!name || name.length > 120) {
    errors.push("El nombre del programa es obligatorio y admite hasta 120 caracteres.");
  }

  if (!loyaltyProgramStatuses.includes(status as LoyaltyProgramStatus)) {
    errors.push("El estado del programa no es válido.");
  }

  if (!loyaltyRuleTypes.includes(ruleType as LoyaltyRuleType)) {
    errors.push("La regla de acumulación no es válida.");
  }

  if (termsAndConditions.length < 10 || termsAndConditions.length > 4000) {
    errors.push("Los términos y condiciones son obligatorios y admiten entre 10 y 4000 caracteres.");
  }

  const tierStamps = texts(formData, "tierStamps");
  const tierNames = texts(formData, "tierName");
  const tierDescriptions = texts(formData, "tierDescription");
  const tierExpirations = texts(formData, "tierExpirationDays");
  const tierCount = Math.max(
    tierStamps.length,
    tierNames.length,
    tierDescriptions.length,
    tierExpirations.length,
  );
  const rewardTiers: RewardTierInput[] = [];

  if (tierCount < 1 || tierCount > 10) {
    errors.push("Configura entre 1 y 10 niveles de recompensa.");
  } else if (
    tierStamps.length !== tierCount
    || tierNames.length !== tierCount
    || tierDescriptions.length !== tierCount
    || tierExpirations.length !== tierCount
  ) {
    errors.push("Todos los niveles deben incluir sellos, nombre y descripción.");
  } else {
    for (let index = 0; index < tierCount; index += 1) {
      const level = index + 1;
      const stampsRequired = parseBoundedInteger(
        tierStamps[index] ?? "",
        `Los sellos del nivel ${level}`,
        1,
        1_000_000,
        errors,
      );
      const tierName = tierNames[index] ?? "";
      const tierDescription = tierDescriptions[index] ?? "";
      const expirationText = tierExpirations[index] ?? "";
      const expirationDays = expirationText
        ? parseBoundedInteger(
            expirationText,
            `La expiración del nivel ${level}`,
            1,
            3650,
            errors,
          )
        : null;

      if (!tierName || tierName.length > 120) {
        errors.push(`El nombre del nivel ${level} es obligatorio y admite hasta 120 caracteres.`);
      }
      if (!tierDescription || tierDescription.length > 500) {
        errors.push(`La descripción del nivel ${level} es obligatoria y admite hasta 500 caracteres.`);
      }

      if (stampsRequired !== null && tierName && tierDescription) {
        rewardTiers.push({
          stampsRequired,
          name: tierName,
          description: tierDescription,
          expirationDays,
        });
      }
    }

    const uniqueStamps = new Set(rewardTiers.map((tier) => tier.stampsRequired));
    if (uniqueStamps.size !== rewardTiers.length) {
      errors.push("Cada nivel debe requerir una cantidad distinta de sellos.");
    }
  }

  let minimumPurchaseMinor = 0;
  let stampsPerPurchase = 1;
  let amountPerStampMinor: number | null = null;
  let carryRemainder = false;

  if (ruleType === "PER_PURCHASE") {
    minimumPurchaseMinor =
      parseMoneyToMinorUnits(
        text(formData, "minimumPurchase"),
        fractionDigits,
        "El monto mínimo",
        true,
        errors,
      ) ?? 0;
    stampsPerPurchase =
      parseBoundedInteger(
        text(formData, "stampsPerPurchase"),
        "La cantidad de sellos por compra",
        1,
        1_000_000,
        errors,
      ) ?? 1;
  } else if (ruleType === "PER_AMOUNT") {
    amountPerStampMinor = parseMoneyToMinorUnits(
      text(formData, "amountPerStamp"),
      fractionDigits,
      "El monto por sello",
      false,
      errors,
    );
    carryRemainder = formData.get("carryRemainder") === "on";
  }

  if (errors.length > 0 || rewardTiers.length !== tierCount) {
    return { ok: false, errors };
  }

  rewardTiers.sort((left, right) => left.stampsRequired - right.stampsRequired);

  return {
    ok: true,
    data: {
      programId: rawProgramId || null,
      name,
      status: status as LoyaltyProgramStatus,
      ruleType: ruleType as LoyaltyRuleType,
      minimumPurchaseMinor,
      stampsPerPurchase,
      amountPerStampMinor,
      carryRemainder,
      termsAndConditions,
      rewardTiers,
    },
  };
}
