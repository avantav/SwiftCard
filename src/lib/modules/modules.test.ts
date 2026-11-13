import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  MODULE_CATALOG,
  catalogInDisplayOrder,
  getModuleEntry,
  isValidModuleKey,
  sellableModules,
  switchesOf
} from "./catalog";
import { createModuleChecker } from "./checker";
import {
  expiryFromDate,
  parseGlobalModeForm,
  parsePackageModulesForm,
  parseTenantModuleForm,
  safeModulesReturnPath
} from "./forms";
import { effectiveGlobalMode, explainTenantModule } from "./state";

function form(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

const TENANT = "80000000-0000-0000-0000-0000000000a1";
const NOW = new Date("2026-11-13T18:00:00Z");

describe("module catalog", () => {
  it("uses unique keys that the database accepts", () => {
    const keys = MODULE_CATALOG.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of MODULE_CATALOG) {
      expect(isValidModuleKey(entry.key), entry.key).toBe(true);
    }
  });

  it("nests every switch under an existing module with a matching key prefix", () => {
    for (const entry of MODULE_CATALOG.filter((item) => item.kind === "SWITCH")) {
      expect(entry.parent, entry.key).toBeDefined();
      expect(getModuleEntry(entry.parent!)?.kind).toBe("MODULE");
      expect(entry.key.startsWith(`${entry.parent}.`)).toBe(true);
    }
    for (const entry of sellableModules()) {
      expect(entry.key.includes(".")).toBe(false);
    }
  });

  it("lists modules followed by their switches", () => {
    const ordered = catalogInDisplayOrder();
    expect(ordered).toHaveLength(MODULE_CATALOG.length);
    expect(ordered[0].key).toBe("swiftpos_integration");
    expect(ordered.slice(1).map((entry) => entry.key)).toEqual(switchesOf("swiftpos_integration").map((entry) => entry.key));
  });

  it("rejects keys the database would reject", () => {
    for (const key of ["", "A", "a", "bad key", "a.b.c", "1module", "module.", "módulo"]) {
      expect(isValidModuleKey(key), key).toBe(false);
    }
  });
});

describe("explainTenantModule", () => {
  const base = { kind: "MODULE" as const, globalMode: "ON" as const, overrideState: null, overrideExpiresAt: null, includedInPlan: true, active: true };

  it("treats a missing state as off for modules and on for switches", () => {
    expect(effectiveGlobalMode("MODULE", null)).toBe("OFF");
    expect(effectiveGlobalMode("SWITCH", null)).toBe("ON");
  });

  it("explains each rule in the same order as the database", () => {
    expect(explainTenantModule({ ...base, globalMode: null, active: false })).toBe("Apagado para todos los tenants.");
    expect(explainTenantModule({ ...base, overrideState: "REVOKED", active: false })).toBe("Revocado para este tenant.");
    expect(explainTenantModule({ ...base, includedInPlan: false, overrideState: "GRANTED" })).toBe("Otorgado por el Superadmin.");
    expect(explainTenantModule({ ...base, includedInPlan: false, overrideState: "GRANTED", overrideExpiresAt: "2026-11-01T00:00:00Z", active: false }, NOW)).toBe("No incluido en su paquete.");
    expect(explainTenantModule({ ...base, globalMode: "BETA", active: false })).toBe("En beta: solo para tenants con otorgamiento.");
    expect(explainTenantModule(base)).toBe("Incluido en su paquete.");
  });

  it("explains switches through their module", () => {
    const sw = { ...base, kind: "SWITCH" as const, globalMode: null };
    expect(explainTenantModule({ ...sw, parentActive: false, active: false })).toBe("Inactivo porque su módulo está inactivo.");
    expect(explainTenantModule({ ...sw, globalMode: "OFF", parentActive: true, active: false })).toBe("Apagado para todos los tenants.");
    expect(explainTenantModule({ ...sw, overrideState: "REVOKED", parentActive: true, active: false })).toBe("Revocado para este tenant.");
    expect(explainTenantModule({ ...sw, parentActive: true })).toBe("Activo con su módulo.");
  });
});

describe("module forms", () => {
  it("requires a catalog key, a valid mode and a reason for global changes", () => {
    expect(parseGlobalModeForm(form({ moduleKey: "swiftpos_integration", mode: "BETA", reason: " Piloto " }))).toEqual({
      ok: true,
      data: { key: "swiftpos_integration", mode: "BETA", reason: "Piloto" }
    });
    expect(parseGlobalModeForm(form({ moduleKey: "unknown", mode: "ON", reason: "Motivo" })).ok).toBe(false);
    expect(parseGlobalModeForm(form({ moduleKey: "swiftpos_integration", mode: "MAYBE", reason: "Motivo" })).ok).toBe(false);
    expect(parseGlobalModeForm(form({ moduleKey: "swiftpos_integration", mode: "ON", reason: "no" })).ok).toBe(false);
    expect(parseGlobalModeForm(form({ moduleKey: "swiftpos_integration.purchases", mode: "BETA", reason: "Motivo" })).ok).toBe(false);
  });

  it("validates tenant adjustments", () => {
    expect(parseTenantModuleForm(form({ moduleKey: "swiftpos_integration", tenantId: TENANT, state: "GRANTED", expiresOn: "2026-12-31", reason: "Piloto" }), NOW)).toEqual({
      ok: true,
      data: { key: "swiftpos_integration", tenantId: TENANT, state: "GRANTED", expiresAt: "2027-01-01T05:59:59.000Z", reason: "Piloto" }
    });
    expect(parseTenantModuleForm(form({ moduleKey: "swiftpos_integration", tenantId: "x", state: "GRANTED", reason: "Piloto" }), NOW).ok).toBe(false);
    expect(parseTenantModuleForm(form({ moduleKey: "swiftpos_integration", tenantId: TENANT, state: "REVOKED", expiresOn: "2026-12-31", reason: "Falla" }), NOW).ok).toBe(false);
    expect(parseTenantModuleForm(form({ moduleKey: "swiftpos_integration.purchases", tenantId: TENANT, state: "GRANTED", reason: "Piloto" }), NOW).ok).toBe(false);
    expect(parseTenantModuleForm(form({ moduleKey: "swiftpos_integration.purchases", tenantId: TENANT, state: "REVOKED", reason: "Falla" }), NOW).ok).toBe(true);
  });

  it("only accepts real future dates as expiry", () => {
    expect(expiryFromDate("", NOW)).toEqual({ ok: true, data: null });
    expect(expiryFromDate("2026-02-31", NOW).ok).toBe(false);
    expect(expiryFromDate("2026-11-12", NOW).ok).toBe(false);
    expect(expiryFromDate("13/11/2026", NOW).ok).toBe(false);
  });

  it("only sells catalog modules in packages", () => {
    expect(parsePackageModulesForm(form({ packageId: TENANT, modules: ["swiftpos_integration", "swiftpos_integration"], reason: "Plan nuevo" }))).toEqual({
      ok: true,
      data: { packageId: TENANT, modules: ["swiftpos_integration"], reason: "Plan nuevo" }
    });
    expect(parsePackageModulesForm(form({ packageId: TENANT, modules: ["swiftpos_integration.purchases"], reason: "Plan nuevo" })).ok).toBe(false);
    expect(parsePackageModulesForm(form({ packageId: TENANT, reason: "Sin módulos" }))).toEqual({ ok: true, data: { packageId: TENANT, modules: [], reason: "Sin módulos" } });
  });

  it("only redirects to module pages", () => {
    expect(safeModulesReturnPath("/superadmin/modules/swiftpos_integration.purchases")).toBe("/superadmin/modules/swiftpos_integration.purchases");
    expect(safeModulesReturnPath(`/superadmin/tenants/${TENANT}/modules`)).toBe(`/superadmin/tenants/${TENANT}/modules`);
    expect(safeModulesReturnPath("https://evil.example/superadmin/modules")).toBe("/superadmin/modules");
    expect(safeModulesReturnPath("//evil.example")).toBe("/superadmin/modules");
  });
});

describe("module checker", () => {
  it("caches results for the configured time", async () => {
    let clock = 0;
    const checker = createModuleChecker({ ttlMs: 30_000, now: () => clock });
    const load = vi.fn(async () => true);
    expect(await checker.check("t:m", load)).toBe(true);
    expect(await checker.check("t:m", load)).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    clock = 30_001;
    await checker.check("t:m", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("evaluates failures and timeouts as inactive without caching them", async () => {
    const checker = createModuleChecker({ timeoutMs: 10 });
    const failing = vi.fn(async () => { throw new Error("db down"); });
    expect(await checker.check("t:m", failing)).toBe(false);
    expect(await checker.check("t:m", failing)).toBe(false);
    expect(failing).toHaveBeenCalledTimes(2);
    expect(await checker.check("t:slow", () => new Promise<boolean>(() => undefined))).toBe(false);
  });
});

describe("tenant modules migration", () => {
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/0080_tenant_modules.sql"), "utf8");

  it("forces RLS on the new tables and keeps writes behind Superadmin RPCs", () => {
    for (const table of ["public.module_states", "public.tenant_module_overrides"]) {
      expect(migration).toContain(`alter table ${table} enable row level security`);
      expect(migration).toContain(`alter table ${table} force row level security`);
    }
    expect(migration).toContain("revoke all on public.module_states, public.tenant_module_overrides from public, anon, authenticated");
    for (const fn of ["set_module_global", "set_tenant_module", "get_module_overview", "get_tenant_modules", "get_module_tenants", "set_billing_package_modules"]) {
      expect(migration).toMatch(new RegExp(`function app\\.${fn}\\([\\s\\S]*?if not app\\.is_superadmin\\(\\)`));
    }
  });

  it("does not let tenants evaluate other tenants", () => {
    expect(migration).toContain("revoke all on function app.tenant_has_module(text, uuid) from public, anon, authenticated");
    expect(migration).not.toMatch(/grant execute on function app\.tenant_has_module\(text, uuid\) to authenticated/);
  });

  it("does not redefine existing functions", () => {
    expect(migration).not.toMatch(/create or replace function/i);
    expect(migration).not.toMatch(/drop function/i);
  });
});
