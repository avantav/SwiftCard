import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateBillingPromotionForm } from "./promotions";

const pageSource = readFileSync(new URL("../../app/superadmin/billing/promotions/page.tsx", import.meta.url), "utf8");
const actionSource = readFileSync(new URL("../../app/superadmin/billing/promotions/actions.ts", import.meta.url), "utf8");
const packageId = "b1000000-0000-0000-0000-000000000001";

function form(values: Record<string, string>, packages = [packageId]) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  packages.forEach((id) => data.append("packageIds", id));
  return data;
}

describe("validateBillingPromotionForm", () => {
  it("normalizes a percentage promotion with membership and redemption caps", () => {
    expect(validateBillingPromotionForm(form({
      code: " lanzamiento20 ", name: " Lanzamiento ", description: "Primeros tenants",
      discountType: "PERCENT", discountValue: "20.50", duration: "REPEATING",
      durationMonths: "3", startsAt: "2026-10-01", endsAt: "2026-12-31",
      maxRedemptions: "100", maxRedemptionsPerTenant: "1", membershipCoverageLimit: "500"
    }))).toEqual({ ok: true, data: {
      code: "LANZAMIENTO20", name: "Lanzamiento", description: "Primeros tenants",
      discountType: "PERCENT", percentOffBasisPoints: 2050, amountOffMinor: null,
      currencyCode: null, duration: "REPEATING", durationMonths: 3,
      startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-12-31T00:00:00.000Z",
      maxRedemptions: 100, maxRedemptionsPerTenant: 1, membershipCoverageLimit: 500,
      packageIds: [packageId]
    } });
  });

  it("stores fixed discounts in minor units", () => {
    const result = validateBillingPromotionForm(form({
      code: "MXN500", name: "Quinientos pesos", discountType: "FIXED_AMOUNT",
      discountValue: "500.25", currencyCode: "mxn", duration: "ONCE",
      maxRedemptionsPerTenant: "1"
    }));
    expect(result).toMatchObject({ ok: true, data: { amountOffMinor: 50025, currencyCode: "MXN" } });
  });

  it("rejects malformed rules and missing package eligibility", () => {
    const result = validateBillingPromotionForm(form({
      code: "x", name: "x", discountType: "PERCENT", discountValue: "101",
      duration: "REPEATING", startsAt: "2026-12-31", endsAt: "2026-01-01",
      maxRedemptionsPerTenant: "0"
    }, []));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThanOrEqual(6);
  });

  it("keeps mutations behind Superadmin session RPCs", () => {
    expect(actionSource).toContain("getActiveSuperadminContext");
    expect(actionSource).toContain('"create_billing_promotion"');
    expect(actionSource).toContain('"set_billing_promotion_status"');
    expect(actionSource).not.toContain("createSupabaseAdminClient");
  });

  it("renders creation, empty, error and archive states", () => {
    for (const copy of ["Crear promoción en borrador", "Aún no hay promociones", "No se pudo cargar el catálogo", "Archivar", "Activar"]) {
      expect(pageSource).toContain(copy);
    }
  });
});
