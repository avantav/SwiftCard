import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateBillingAffiliateForm } from "./affiliates";

const pageSource = readFileSync(new URL("../../app/superadmin/billing/affiliates/page.tsx", import.meta.url), "utf8");
const actionSource = readFileSync(new URL("../../app/superadmin/billing/affiliates/actions.ts", import.meta.url), "utf8");

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("validateBillingAffiliateForm", () => {
  it("normalizes a percentage commission and contact", () => {
    expect(validateBillingAffiliateForm(form({
      code: " socio_norte ", displayName: " Socio Norte ",
      contactEmail: " VENTAS@EXAMPLE.COM ", commissionType: "PERCENT",
      commissionValue: "12.50", attributionWindowDays: "45"
    }))).toEqual({ ok: true, data: {
      code: "SOCIO_NORTE", displayName: "Socio Norte", contactEmail: "ventas@example.com",
      commissionType: "PERCENT", commissionBasisPoints: 1250,
      commissionAmountMinor: null, currencyCode: null, attributionWindowDays: 45
    } });
  });

  it("stores fixed commission money in minor units", () => {
    const result = validateBillingAffiliateForm(form({
      code: "SOCIO500", displayName: "Socio fijo", commissionType: "FIXED_AMOUNT",
      commissionValue: "500.25", currencyCode: "mxn", attributionWindowDays: "30"
    }));
    expect(result).toMatchObject({ ok: true, data: { commissionAmountMinor: 50025, currencyCode: "MXN" } });
  });

  it("rejects invalid identity, commission and attribution window", () => {
    const result = validateBillingAffiliateForm(form({
      code: "x", displayName: "x", contactEmail: "invalid", commissionType: "PERCENT",
      commissionValue: "101", attributionWindowDays: "366"
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(5);
  });

  it("keeps mutations behind Superadmin session RPCs", () => {
    expect(actionSource).toContain("getActiveSuperadminContext");
    expect(actionSource).toContain('"create_billing_affiliate"');
    expect(actionSource).toContain('"set_billing_affiliate_status"');
    expect(actionSource).not.toContain("createSupabaseAdminClient");
  });

  it("renders creation, empty, error and archive states", () => {
    for (const copy of ["Crear afiliado en borrador", "Aún no hay afiliados", "No se pudo cargar el directorio", "Archivar", "Activar"]) expect(pageSource).toContain(copy);
  });
});
