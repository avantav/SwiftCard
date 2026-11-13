type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORE_PATTERN = /^[A-Za-z0-9_.:-]{1,100}$/;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function parseReasonForm(formData: FormData): Result<string> {
  const reason = text(formData, "reason");
  return reason.length >= 3 && reason.length <= 500
    ? { ok: true, data: reason }
    : { ok: false, error: "Escribe un motivo de entre 3 y 500 caracteres." };
}

/** An empty branch removes the mapping of that SwiftPOS store. */
export function parseBranchLinkForm(formData: FormData): Result<{ storeId: string; branchId: string | null; reason: string }> {
  const storeId = text(formData, "storeId");
  if (!STORE_PATTERN.test(storeId)) {
    return { ok: false, error: "El ID de sucursal de SwiftPOS solo admite letras, números, guion, guion bajo, punto y dos puntos (máximo 100)." };
  }
  const branch = text(formData, "branchId");
  if (branch && !UUID_PATTERN.test(branch)) return { ok: false, error: "Selecciona una sucursal válida." };
  const reason = parseReasonForm(formData);
  if (!reason.ok) return reason;
  return { ok: true, data: { storeId, branchId: branch || null, reason: reason.data } };
}

/** The maximum amount is captured in major units (pesos) and stored in minor units. */
export function parseLimitsForm(formData: FormData): Result<{ maxAmountMinor: number; maxPerHour: number; maxPerDay: number; reason: string }> {
  const amount = text(formData, "maxAmount");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    return { ok: false, error: "El monto máximo debe ser mayor a cero, con hasta dos decimales." };
  }
  const [whole, cents = ""] = amount.split(".");
  const maxAmountMinor = Number(whole) * 100 + Number(cents.padEnd(2, "0"));
  const maxPerHour = Number(text(formData, "maxPerHour"));
  const maxPerDay = Number(text(formData, "maxPerDay"));
  if (!Number.isInteger(maxPerHour) || maxPerHour < 1 || maxPerHour > 100) {
    return { ok: false, error: "Las compras por hora deben estar entre 1 y 100." };
  }
  if (!Number.isInteger(maxPerDay) || maxPerDay < 1 || maxPerDay > 500) {
    return { ok: false, error: "Las compras por día deben estar entre 1 y 500." };
  }
  if (maxPerHour > maxPerDay) return { ok: false, error: "Las compras por hora no pueden superar las compras por día." };
  const reason = parseReasonForm(formData);
  if (!reason.ok) return reason;
  return { ok: true, data: { maxAmountMinor, maxPerHour, maxPerDay, reason: reason.data } };
}
