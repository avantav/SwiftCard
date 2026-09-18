import { getCurrencyFractionDigits } from "@/lib/admin/program";

export type BillingPromotionInput = {
  code: string;
  name: string;
  description: string;
  discountType: "PERCENT" | "FIXED_AMOUNT";
  percentOffBasisPoints: number | null;
  amountOffMinor: number | null;
  currencyCode: string | null;
  duration: "ONCE" | "REPEATING" | "FOREVER";
  durationMonths: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  maxRedemptionsPerTenant: number;
  membershipCoverageLimit: number | null;
  packageIds: string[];
};

export type BillingPromotionValidationResult =
  | { ok: true; data: BillingPromotionInput }
  | { ok: false; errors: string[] };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalInteger(raw: string, label: string, errors: string[]) {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 100_000_000) {
    errors.push(`${label} debe ser un entero entre 1 y 100000000.`);
    return null;
  }
  return value;
}

function decimalToScaled(raw: string, scaleDigits: number, label: string, errors: string[]) {
  const pattern = new RegExp(`^\\d+(?:\\.\\d{1,${scaleDigits}})?$`);
  if (!raw || raw.length > 24 || !pattern.test(raw)) {
    errors.push(`${label} debe ser un importe válido con máximo ${scaleDigits} decimales.`);
    return null;
  }
  const [whole, decimal = ""] = raw.split(".");
  const result = BigInt(whole) * (BigInt(10) ** BigInt(scaleDigits))
    + BigInt(decimal.padEnd(scaleDigits, "0") || "0");
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    errors.push(`${label} es demasiado grande.`);
    return null;
  }
  return Number(result);
}

function optionalDate(raw: string, label: string, errors: string[]) {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    errors.push(`${label} no es válida.`);
    return null;
  }
  return date.toISOString();
}

export function validateBillingPromotionForm(formData: FormData): BillingPromotionValidationResult {
  const errors: string[] = [];
  const code = text(formData, "code").toUpperCase();
  const name = text(formData, "name");
  const description = text(formData, "description");
  const discountType = text(formData, "discountType");
  const duration = text(formData, "duration");
  const currencyCode = text(formData, "currencyCode").toUpperCase();

  if (!/^[A-Z0-9][A-Z0-9_-]{2,49}$/.test(code)) errors.push("Código debe tener de 3 a 50 caracteres válidos.");
  if (name.length < 2 || name.length > 100) errors.push("Nombre debe tener entre 2 y 100 caracteres.");
  if (description.length > 500) errors.push("Descripción admite máximo 500 caracteres.");
  if (discountType !== "PERCENT" && discountType !== "FIXED_AMOUNT") errors.push("Tipo de descuento no es válido.");
  if (!(["ONCE", "REPEATING", "FOREVER"] as string[]).includes(duration)) errors.push("Duración no es válida.");

  let percentOffBasisPoints: number | null = null;
  let amountOffMinor: number | null = null;
  let normalizedCurrency: string | null = null;
  if (discountType === "PERCENT") {
    percentOffBasisPoints = decimalToScaled(text(formData, "discountValue"), 2, "Porcentaje", errors);
    if (percentOffBasisPoints !== null && (percentOffBasisPoints < 1 || percentOffBasisPoints > 10_000)) {
      errors.push("Porcentaje debe ser mayor que 0 y máximo 100.");
    }
  } else if (discountType === "FIXED_AMOUNT") {
    if (!/^[A-Z]{3}$/.test(currencyCode)) errors.push("Moneda debe usar un código ISO de 3 letras.");
    normalizedCurrency = currencyCode;
    amountOffMinor = decimalToScaled(text(formData, "discountValue"), getCurrencyFractionDigits(currencyCode), "Monto", errors);
    if (amountOffMinor === 0) errors.push("Monto debe ser mayor que 0.");
  }

  const durationMonths = duration === "REPEATING"
    ? optionalInteger(text(formData, "durationMonths"), "Meses de duración", errors)
    : null;
  const startsAt = optionalDate(text(formData, "startsAt"), "Fecha inicial", errors);
  const endsAt = optionalDate(text(formData, "endsAt"), "Fecha final", errors);
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) errors.push("Fecha final debe ser posterior a la inicial.");

  const maxRedemptions = optionalInteger(text(formData, "maxRedemptions"), "Máximo global", errors);
  const maxRedemptionsPerTenant = optionalInteger(text(formData, "maxRedemptionsPerTenant"), "Máximo por tenant", errors);
  const membershipCoverageLimit = optionalInteger(text(formData, "membershipCoverageLimit"), "Membresías cubiertas", errors);
  const packageIds = [...new Set(formData.getAll("packageIds").filter((value): value is string => typeof value === "string"))];
  if (packageIds.length === 0 || packageIds.some((id) => !uuidPattern.test(id))) errors.push("Selecciona al menos un paquete elegible válido.");

  if (errors.length > 0 || !maxRedemptionsPerTenant || (discountType !== "PERCENT" && discountType !== "FIXED_AMOUNT") || !(duration === "ONCE" || duration === "REPEATING" || duration === "FOREVER")) {
    return { ok: false, errors };
  }
  return { ok: true, data: { code, name, description, discountType, percentOffBasisPoints, amountOffMinor, currencyCode: normalizedCurrency, duration, durationMonths, startsAt, endsAt, maxRedemptions, maxRedemptionsPerTenant, membershipCoverageLimit, packageIds } };
}
