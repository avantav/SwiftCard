import type { ModuleKind } from "./catalog";

export type GlobalMode = "OFF" | "BETA" | "ON";
export type OverrideState = "GRANTED" | "REVOKED";
export type TenantModuleChoice = "INHERIT" | OverrideState;

export const GLOBAL_MODES: readonly GlobalMode[] = ["OFF", "BETA", "ON"];
export const TENANT_CHOICES: readonly TenantModuleChoice[] = ["INHERIT", "GRANTED", "REVOKED"];

/** A missing state means OFF for modules and ON (follows its module) for switches. */
export function effectiveGlobalMode(kind: ModuleKind, mode: GlobalMode | null): GlobalMode {
  return mode ?? (kind === "MODULE" ? "OFF" : "ON");
}

export const GLOBAL_MODE_COPY: Record<GlobalMode, { label: string; badge: string; help: string }> = {
  OFF: { label: "Apagado", badge: "is-neutral", help: "Inactivo para todos los tenants, aunque lo paguen." },
  BETA: { label: "Beta", badge: "is-suspended", help: "Solo para los tenants a los que se les otorgue." },
  ON: { label: "Disponible", badge: "is-active", help: "Activo para cada tenant según su paquete o un otorgamiento." }
};

export const SWITCH_MODE_COPY: Record<"OFF" | "ON", { label: string; badge: string; help: string }> = {
  OFF: { label: "Apagado", badge: "is-neutral", help: "Esta parte está detenida para todos los tenants." },
  ON: { label: "Sigue al módulo", badge: "is-active", help: "Activa donde el módulo esté activo." }
};

export const TENANT_CHOICE_COPY: Record<TenantModuleChoice, string> = {
  INHERIT: "Según su paquete",
  GRANTED: "Otorgado",
  REVOKED: "Revocado"
};

export type TenantModuleRow = {
  kind: ModuleKind;
  globalMode: GlobalMode | null;
  overrideState: OverrideState | null;
  overrideExpiresAt: string | null;
  includedInPlan: boolean;
  active: boolean;
  parentActive?: boolean;
};

/** Plain-language reason for a tenant's effective state, mirroring app.tenant_has_module. */
export function explainTenantModule(row: TenantModuleRow, now = new Date()): string {
  const mode = effectiveGlobalMode(row.kind, row.globalMode);
  if (row.kind === "SWITCH") {
    if (row.parentActive === false) return "Inactivo porque su módulo está inactivo.";
    if (mode === "OFF") return "Apagado para todos los tenants.";
    if (row.overrideState === "REVOKED") return "Revocado para este tenant.";
    return row.active ? "Activo con su módulo." : "Inactivo porque su módulo está inactivo.";
  }
  if (mode === "OFF") return "Apagado para todos los tenants.";
  if (row.overrideState === "REVOKED") return "Revocado para este tenant.";
  if (row.overrideState === "GRANTED") {
    const expired = row.overrideExpiresAt !== null && new Date(row.overrideExpiresAt) <= now;
    if (!expired) return "Otorgado por el Superadmin.";
  }
  if (mode === "BETA") return "En beta: solo para tenants con otorgamiento.";
  return row.includedInPlan ? "Incluido en su paquete." : "No incluido en su paquete.";
}

export function formatModuleDate(value: string | null): string {
  if (!value) return "Sin vencimiento";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Mexico_City"
  }).format(new Date(value));
}
