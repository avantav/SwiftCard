import { getCurrencyFractionDigits } from "@/lib/admin/program";

export type BillingPackageInput = {
  code: string;
  name: string;
  description: string;
  membershipLimit: number | null;
  branchLimit: number | null;
  loyaltyCardLimit: number | null;
  entitlements: Record<string, boolean>;
  currencyCode: string;
  billingInterval: "MONTH" | "YEAR";
  amountMinor: number;
};

export type BillingPackageValidationResult =
  | { ok: true; data: BillingPackageInput }
  | { ok: false; errors: string[] };

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalInteger(
  raw: string,
  label: string,
  min: number,
  max: number,
  errors: string[]
) {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${label} debe ser un entero entre ${min} y ${max}.`);
    return null;
  }
  return value;
}

function amountToMinor(raw: string, currencyCode: string, errors: string[]) {
  const fractionDigits = getCurrencyFractionDigits(currencyCode);
  const pattern = fractionDigits === 0
    ? /^\d+$/
    : new RegExp(`^\\d+(?:\\.\\d{1,${fractionDigits}})?$`);

  if (!raw || raw.length > 24 || !pattern.test(raw)) {
    errors.push(`Precio debe ser un importe válido con máximo ${fractionDigits} decimales.`);
    return 0;
  }

  const [whole, decimal = ""] = raw.split(".");
  const scale = BigInt(10) ** BigInt(fractionDigits);
  const minor = BigInt(whole) * scale + BigInt(decimal.padEnd(fractionDigits, "0") || "0");
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    errors.push("Precio es demasiado grande.");
    return 0;
  }
  return Number(minor);
}

export function validateBillingPackageForm(
  formData: FormData
): BillingPackageValidationResult {
  const errors: string[] = [];
  const code = text(formData, "code").toLowerCase();
  const name = text(formData, "name");
  const description = text(formData, "description");
  const currencyCode = text(formData, "currencyCode").toUpperCase();
  const billingInterval = text(formData, "billingInterval");

  if (!/^[a-z0-9][a-z0-9_-]{1,49}$/.test(code)) {
    errors.push("Código debe tener de 2 a 50 caracteres: letras, números, guion o guion bajo.");
  }
  if (name.length < 2 || name.length > 100) {
    errors.push("Nombre debe tener entre 2 y 100 caracteres.");
  }
  if (description.length > 500) {
    errors.push("Descripción admite máximo 500 caracteres.");
  }
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    errors.push("Moneda debe usar un código ISO de 3 letras.");
  }
  if (billingInterval !== "MONTH" && billingInterval !== "YEAR") {
    errors.push("Periodicidad no es válida.");
  }

  const membershipLimit = optionalInteger(
    text(formData, "membershipLimit"), "Límite de membresías", 1, 100_000_000, errors
  );
  const branchLimit = optionalInteger(
    text(formData, "branchLimit"), "Límite de sucursales", 1, 100_000, errors
  );
  const loyaltyCardLimit = optionalInteger(
    text(formData, "loyaltyCardLimit"), "Límite de tarjetas", 1, 3, errors
  );
  const amountMinor = amountToMinor(text(formData, "amount"), currencyCode, errors);

  if (errors.length > 0 || (billingInterval !== "MONTH" && billingInterval !== "YEAR")) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      code,
      name,
      description,
      membershipLimit,
      branchLimit,
      loyaltyCardLimit,
      entitlements: {
        appleWallet: formData.get("appleWallet") === "on",
        googleWallet: formData.get("googleWallet") === "on",
        whiteLabel: formData.get("whiteLabel") === "on",
        advancedAnalytics: formData.get("advancedAnalytics") === "on"
      },
      currencyCode,
      billingInterval,
      amountMinor
    }
  };
}
