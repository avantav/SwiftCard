import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatServiceOrderPrice, validateServiceOrderForm } from "./service-orders";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

const valid = {
  planName: "Empresarial",
  price: "1500.50",
  currencyCode: "MXN",
  billingInterval: "MONTH",
  includedScope: "Tres sucursales y campañas",
  excludedScope: "Integraciones a la medida",
  startsOn: "2026-12-01",
  endsOn: "",
};

describe("service order form (DEC-0076)", () => {
  it("stores the price in minor units and keeps the end date optional", () => {
    const result = validateServiceOrderForm(form(valid));
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ priceMinor: 150050, currencyCode: "MXN", endsOn: null }) });
  });

  it("rejects invalid prices, intervals, short scopes and inverted dates", () => {
    expect(validateServiceOrderForm(form({ ...valid, price: "abc" })).ok).toBe(false);
    expect(validateServiceOrderForm(form({ ...valid, price: "10.999" })).ok).toBe(false);
    expect(validateServiceOrderForm(form({ ...valid, billingInterval: "WEEK" })).ok).toBe(false);
    expect(validateServiceOrderForm(form({ ...valid, excludedScope: "corto" })).ok).toBe(false);
    expect(validateServiceOrderForm(form({ ...valid, endsOn: "2026-11-01" })).ok).toBe(false);
  });

  it("formats the price before VAT with its periodicity", () => {
    expect(formatServiceOrderPrice({ price_minor: 150050, currency_code: "MXN", billing_interval: "YEAR" })).toBe("$1,500.50 + IVA, anual");
  });
});

describe("service order boundaries", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

  it("is created only by the Superadmin and accepted only by the Admin general with conformity", () => {
    const migration = read("../../../supabase/migrations/0083_tenant_service_orders.sql");
    expect(migration).toContain("if not app.is_superadmin() then");
    expect(migration).toContain("sp.role = 'ADMIN'");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("'SERVICE_ORDER_ACCEPTED'");
    const actions = read("../../app/admin/billing/actions.ts");
    expect(actions).toContain('requireInternalArea("ADMIN", { writable: true })');
    expect(actions).toContain('formData.get("conformity") !== "on"');
    expect(read("../../app/superadmin/tenants/[tenantId]/service-order/actions.ts")).toContain("getActiveSuperadminContext");
  });
});

describe("customer anonymization (DEC-0075)", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

  it("is an audited Admin general action that freezes the row", () => {
    const migration = read("../../../supabase/migrations/0082_customer_anonymization.sql");
    expect(migration).toContain("'CUSTOMER_ANONYMIZED'");
    expect(migration).toContain("customers_prevent_anonymized_changes");
    expect(read("../../app/admin/customers/actions.ts")).toContain('"anonymize_admin_customer"');
    expect(read("../../app/admin/customers/page.tsx")).toContain("Eliminar datos personales");
  });

  it("asks the operator to confirm the privacy notice before importing customers", () => {
    expect(read("../../app/admin/imports/actions.ts")).toContain('formData.get("consentConfirmed") !== "on"');
    expect(read("../../app/superadmin/imports/actions.ts")).toContain('formData.get("consentConfirmed") !== "on"');
  });
});
