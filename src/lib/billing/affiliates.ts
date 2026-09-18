import { getCurrencyFractionDigits } from "@/lib/admin/program";

export type BillingAffiliateInput = {
  code: string;
  displayName: string;
  contactEmail: string | null;
  commissionType: "PERCENT" | "FIXED_AMOUNT";
  commissionBasisPoints: number | null;
  commissionAmountMinor: number | null;
  currencyCode: string | null;
  attributionWindowDays: number;
};

export type BillingAffiliateValidationResult =
  | { ok: true; data: BillingAffiliateInput }
  | { ok: false; errors: string[] };

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function decimalToScaled(raw: string, digits: number, label: string, errors: string[]) {
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`);
  if (!raw || raw.length > 24 || !pattern.test(raw)) {
    errors.push(`${label} debe ser un importe válido con máximo ${digits} decimales.`);
    return null;
  }
  const [whole, decimal = ""] = raw.split(".");
  const value = BigInt(whole) * (BigInt(10) ** BigInt(digits))
    + BigInt(decimal.padEnd(digits, "0") || "0");
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    errors.push(`${label} es demasiado grande.`);
    return null;
  }
  return Number(value);
}

export function validateBillingAffiliateForm(formData: FormData): BillingAffiliateValidationResult {
  const errors: string[] = [];
  const code = text(formData, "code").toUpperCase();
  const displayName = text(formData, "displayName");
  const contactEmailValue = text(formData, "contactEmail").toLowerCase();
  const contactEmail = contactEmailValue || null;
  const commissionType = text(formData, "commissionType");
  const currencyCode = text(formData, "currencyCode").toUpperCase();
  const attributionWindowDays = Number(text(formData, "attributionWindowDays"));

  if (!/^[A-Z0-9][A-Z0-9_-]{2,49}$/.test(code)) errors.push("Código debe tener de 3 a 50 caracteres válidos.");
  if (displayName.length < 2 || displayName.length > 120) errors.push("Nombre debe tener entre 2 y 120 caracteres.");
  if (contactEmail && (contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) errors.push("Correo de contacto no es válido.");
  if (commissionType !== "PERCENT" && commissionType !== "FIXED_AMOUNT") errors.push("Tipo de comisión no es válido.");
  if (!Number.isInteger(attributionWindowDays) || attributionWindowDays < 1 || attributionWindowDays > 365) errors.push("Ventana de atribución debe ser un entero entre 1 y 365 días.");

  let commissionBasisPoints: number | null = null;
  let commissionAmountMinor: number | null = null;
  let normalizedCurrency: string | null = null;
  if (commissionType === "PERCENT") {
    commissionBasisPoints = decimalToScaled(text(formData, "commissionValue"), 2, "Porcentaje", errors);
    if (commissionBasisPoints !== null && (commissionBasisPoints < 1 || commissionBasisPoints > 10_000)) errors.push("Porcentaje debe ser mayor que 0 y máximo 100.");
  } else if (commissionType === "FIXED_AMOUNT") {
    if (!/^[A-Z]{3}$/.test(currencyCode)) errors.push("Moneda debe usar un código ISO de 3 letras.");
    normalizedCurrency = currencyCode;
    commissionAmountMinor = decimalToScaled(text(formData, "commissionValue"), getCurrencyFractionDigits(currencyCode), "Monto", errors);
    if (commissionAmountMinor === 0) errors.push("Monto debe ser mayor que 0.");
  }

  if (errors.length > 0 || (commissionType !== "PERCENT" && commissionType !== "FIXED_AMOUNT")) return { ok: false, errors };
  return { ok: true, data: { code, displayName, contactEmail, commissionType, commissionBasisPoints, commissionAmountMinor, currencyCode: normalizedCurrency, attributionWindowDays } };
}
