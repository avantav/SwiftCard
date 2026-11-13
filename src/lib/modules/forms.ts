import { getModuleEntry, sellableModules } from "./catalog";
import { GLOBAL_MODES, TENANT_CHOICES, type GlobalMode, type TenantModuleChoice } from "./state";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function reason(formData: FormData): Result<string> {
  const value = text(formData, "reason");
  if (value.length < 3 || value.length > 500) {
    return { ok: false, error: "Escribe un motivo de entre 3 y 500 caracteres." };
  }
  return { ok: true, data: value };
}

export function parseGlobalModeForm(formData: FormData): Result<{ key: string; mode: GlobalMode; reason: string }> {
  const key = text(formData, "moduleKey");
  const entry = getModuleEntry(key);
  if (!entry) return { ok: false, error: "El módulo no existe en el catálogo." };
  const mode = text(formData, "mode") as GlobalMode;
  const allowed: readonly GlobalMode[] = entry.kind === "SWITCH" ? ["OFF", "ON"] : GLOBAL_MODES;
  if (!allowed.includes(mode)) return { ok: false, error: "El estado global no es válido." };
  const why = reason(formData);
  if (!why.ok) return why;
  return { ok: true, data: { key, mode, reason: why.data } };
}

/**
 * Expiry comes from a date input and means "until the end of that day" in
 * Mexico City time (UTC-6, no daylight saving since 2022).
 */
export function expiryFromDate(value: string, now = new Date()): Result<string | null> {
  if (!value) return { ok: true, data: null };
  if (!DATE_PATTERN.test(value)) return { ok: false, error: "La fecha de vencimiento no es válida." };
  const calendarDay = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(calendarDay.getTime()) || calendarDay.toISOString().slice(0, 10) !== value) {
    return { ok: false, error: "La fecha de vencimiento no es válida." };
  }
  const expiry = new Date(`${value}T23:59:59-06:00`);
  if (expiry <= now) return { ok: false, error: "La fecha de vencimiento debe ser futura." };
  return { ok: true, data: expiry.toISOString() };
}

export function parseTenantModuleForm(
  formData: FormData,
  now = new Date()
): Result<{ key: string; tenantId: string; state: TenantModuleChoice; expiresAt: string | null; reason: string }> {
  const key = text(formData, "moduleKey");
  if (!getModuleEntry(key)) return { ok: false, error: "El módulo no existe en el catálogo." };
  const tenantId = text(formData, "tenantId");
  if (!UUID_PATTERN.test(tenantId)) return { ok: false, error: "Selecciona un tenant válido." };
  const state = text(formData, "state") as TenantModuleChoice;
  if (!TENANT_CHOICES.includes(state)) return { ok: false, error: "El ajuste no es válido." };
  if (state === "GRANTED" && getModuleEntry(key)?.kind === "SWITCH") {
    return { ok: false, error: "Las partes de un módulo no se otorgan; otorga el módulo." };
  }
  const expiryInput = text(formData, "expiresOn");
  if (expiryInput && state !== "GRANTED") {
    return { ok: false, error: "Solo un otorgamiento puede tener vencimiento." };
  }
  const expiry = expiryFromDate(expiryInput, now);
  if (!expiry.ok) return expiry;
  const why = reason(formData);
  if (!why.ok) return why;
  return { ok: true, data: { key, tenantId, state, expiresAt: expiry.data, reason: why.data } };
}

export function parsePackageModulesForm(formData: FormData): Result<{ packageId: string; modules: string[]; reason: string }> {
  const packageId = text(formData, "packageId");
  if (!UUID_PATTERN.test(packageId)) return { ok: false, error: "El paquete no es válido." };
  const sellable = new Set(sellableModules().map((entry) => entry.key));
  const modules = formData.getAll("modules").map(String);
  if (modules.some((key) => !sellable.has(key))) {
    return { ok: false, error: "Solo se pueden incluir módulos del catálogo." };
  }
  const why = reason(formData);
  if (!why.ok) return why;
  return { ok: true, data: { packageId, modules: [...new Set(modules)].sort(), reason: why.data } };
}

/** Where a tenant-module form may send the Superadmin back to. */
export function safeModulesReturnPath(value: string): string {
  return /^\/superadmin\/(modules(\/[a-z0-9_.]+)?|tenants\/[0-9a-f-]{36}\/modules)$/i.test(value)
    ? value
    : "/superadmin/modules";
}
