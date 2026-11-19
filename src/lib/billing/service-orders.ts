import { formatPurchaseAmount, parsePurchaseAmount } from "@/lib/loyalty/purchase-amount";

/** Per-tenant commercial conditions accepted by the Admin general (DEC-0076). */
export type ServiceOrder = {
  id: string;
  version: number;
  plan_name: string;
  price_minor: number;
  currency_code: string;
  billing_interval: ServiceOrderInterval;
  included_scope: string;
  excluded_scope: string;
  starts_on: string;
  ends_on: string | null;
  created_at: string;
  accepted_at: string | null;
};

export const SERVICE_ORDER_INTERVALS = ["MONTH", "YEAR", "ONE_TIME"] as const;
export type ServiceOrderInterval = (typeof SERVICE_ORDER_INTERVALS)[number];

export const SERVICE_ORDER_COLUMNS =
  "id,version,plan_name,price_minor,currency_code,billing_interval,included_scope,excluded_scope,starts_on,ends_on,created_at,accepted_at";

export function serviceOrderIntervalLabel(interval: ServiceOrderInterval) {
  return interval === "MONTH" ? "mensual" : interval === "YEAR" ? "anual" : "pago único";
}

export function formatServiceOrderPrice(order: Pick<ServiceOrder, "price_minor" | "currency_code" | "billing_interval">) {
  return `${formatPurchaseAmount(order.price_minor, order.currency_code)} + IVA, ${serviceOrderIntervalLabel(order.billing_interval)}`;
}

export type ServiceOrderInput = {
  planName: string;
  priceMinor: number;
  currencyCode: string;
  billingInterval: ServiceOrderInterval;
  includedScope: string;
  excludedScope: string;
  startsOn: string;
  endsOn: string | null;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Mirrors the database constraints of public.tenant_service_orders. */
export function validateServiceOrderForm(formData: FormData):
  | { ok: true; data: ServiceOrderInput }
  | { ok: false; error: string } {
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const currencyCode = (text("currencyCode") || "MXN").toUpperCase();
  const planName = text("planName");
  const includedScope = text("includedScope");
  const excludedScope = text("excludedScope");
  const billingInterval = text("billingInterval") as ServiceOrderInterval;
  const startsOn = text("startsOn");
  const endsOn = text("endsOn") || null;

  if (!/^[A-Z]{3}$/.test(currencyCode)) return { ok: false, error: "La moneda no es válida." };
  if (planName.length < 2 || planName.length > 80) return { ok: false, error: "Escribe el nombre del plan (2 a 80 caracteres)." };
  const priceMinor = parsePurchaseAmount(text("price"), currencyCode);
  if (priceMinor === null) return { ok: false, error: "Escribe un precio válido sin IVA." };
  if (!SERVICE_ORDER_INTERVALS.includes(billingInterval)) return { ok: false, error: "Elige la periodicidad." };
  if (includedScope.length < 10 || includedScope.length > 4000) return { ok: false, error: "Describe lo incluido (10 a 4000 caracteres)." };
  if (excludedScope.length < 10 || excludedScope.length > 4000) return { ok: false, error: "Describe lo no incluido (10 a 4000 caracteres)." };
  if (!DATE.test(startsOn)) return { ok: false, error: "Elige la fecha de inicio." };
  if (endsOn && (!DATE.test(endsOn) || endsOn < startsOn)) return { ok: false, error: "La fecha de fin debe ser posterior al inicio." };

  return { ok: true, data: { planName, priceMinor, currencyCode, billingInterval, includedScope, excludedScope, startsOn, endsOn } };
}
