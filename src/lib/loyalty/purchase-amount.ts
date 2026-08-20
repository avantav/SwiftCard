import { getCurrencyFractionDigits } from "@/lib/admin/program";

export function parsePurchaseAmount(value: string, currencyCode: string) {
  const raw = value.trim();
  const fractionDigits = getCurrencyFractionDigits(currencyCode);
  const pattern = fractionDigits === 0
    ? /^\d+$/
    : new RegExp(`^\\d+(?:\\.\\d{1,${fractionDigits}})?$`);
  if (!raw || raw.length > 24 || !pattern.test(raw)) return null;

  const [whole, decimal = ""] = raw.split(".");
  const scale = BigInt(10) ** BigInt(fractionDigits);
  const minor = BigInt(whole) * scale + BigInt(decimal.padEnd(fractionDigits, "0") || "0");
  if (minor < 1 || minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(minor);
}

export function formatPurchaseAmount(minorUnits: number, currencyCode: string) {
  const fractionDigits = getCurrencyFractionDigits(currencyCode);
  return new Intl.NumberFormat("es-MX", { currency: currencyCode, style: "currency" })
    .format(minorUnits / 10 ** fractionDigits);
}

export function purchaseAmountInputStep(currencyCode: string) {
  const fractionDigits = getCurrencyFractionDigits(currencyCode);
  return fractionDigits === 0 ? "1" : `0.${"0".repeat(fractionDigits - 1)}1`;
}
