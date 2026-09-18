import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateBillingPackageForm } from "./packages";

const pageSource = readFileSync(
  new URL("../../app/superadmin/billing/packages/page.tsx", import.meta.url),
  "utf8"
);
const actionSource = readFileSync(
  new URL("../../app/superadmin/billing/packages/actions.ts", import.meta.url),
  "utf8"
);

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("validateBillingPackageForm", () => {
  it("normalizes a valid monthly package and stores money in minor units", () => {
    const data = form({
      code: " Growth_MX ",
      name: " Growth México ",
      description: "Hasta 2,500 membresías",
      membershipLimit: "2500",
      branchLimit: "5",
      loyaltyCardLimit: "3",
      currencyCode: "mxn",
      billingInterval: "MONTH",
      amount: "1299.50",
      appleWallet: "on",
      googleWallet: "on"
    });

    expect(validateBillingPackageForm(data)).toEqual({
      ok: true,
      data: {
        code: "growth_mx",
        name: "Growth México",
        description: "Hasta 2,500 membresías",
        membershipLimit: 2500,
        branchLimit: 5,
        loyaltyCardLimit: 3,
        entitlements: {
          appleWallet: true,
          googleWallet: true,
          whiteLabel: false,
          advancedAnalytics: false
        },
        currencyCode: "MXN",
        billingInterval: "MONTH",
        amountMinor: 129950
      }
    });
  });

  it("allows an unlimited free package explicitly", () => {
    const result = validateBillingPackageForm(form({
      code: "free",
      name: "Piloto",
      currencyCode: "MXN",
      billingInterval: "YEAR",
      amount: "0"
    }));

    expect(result).toMatchObject({
      ok: true,
      data: {
        membershipLimit: null,
        branchLimit: null,
        loyaltyCardLimit: null,
        amountMinor: 0
      }
    });
  });

  it("rejects invalid codes, limits, intervals and amounts", () => {
    const result = validateBillingPackageForm(form({
      code: "!",
      name: "x",
      membershipLimit: "0",
      branchLimit: "1.5",
      loyaltyCardLimit: "4",
      currencyCode: "MX",
      billingInterval: "WEEK",
      amount: "10.999"
    }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(8);
  });

  it("keeps package mutations behind Superadmin session RPCs", () => {
    expect(actionSource).toContain("getActiveSuperadminContext");
    expect(actionSource).toContain('.schema("app").rpc(');
    expect(actionSource).toContain('"create_billing_package"');
    expect(actionSource).toContain('"set_billing_package_status"');
    expect(actionSource).not.toContain("createSupabaseAdminClient");
  });

  it("renders creation, empty, error and archive states", () => {
    expect(pageSource).toContain("Crear paquete en borrador");
    expect(pageSource).toContain("Aún no hay paquetes");
    expect(pageSource).toContain("No se pudo cargar el catálogo");
    expect(pageSource).toContain("Archivar");
    expect(pageSource).toContain("Activar");
  });
});
