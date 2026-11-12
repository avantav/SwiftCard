import { describe, expect, it } from "vitest";
import { buildPricingPlans, formatPesos, PLAN_COPY, type CatalogPackage } from "./pricing";

function pkg(code: string, monthly: number, extra: Partial<CatalogPackage> = {}): CatalogPackage {
  return {
    code,
    name: code[0]!.toUpperCase() + code.slice(1),
    branch_limit: 1,
    loyalty_card_limit: 1,
    membership_limit: null,
    billing_package_prices: [
      { billing_interval: "MONTH", currency_code: "MXN", amount_minor: monthly, status: "ACTIVE" },
      { billing_interval: "YEAR", currency_code: "MXN", amount_minor: monthly * 10, status: "ACTIVE" },
    ],
    ...extra,
  };
}

describe("buildPricingPlans", () => {
  it("orders catalog plans by monthly price and derives limits", () => {
    const plans = buildPricingPlans([
      pkg("empresarial", 99900, { branch_limit: 10, loyalty_card_limit: 3 }),
      pkg("inicial", 39900),
      pkg("crecimiento", 69900, { branch_limit: 3, loyalty_card_limit: 2 }),
    ]);
    expect(plans.map((plan) => plan.code)).toEqual(["inicial", "crecimiento", "empresarial"]);
    expect(plans[0]?.limits).toEqual(["1 sucursal", "1 tarjeta de lealtad"]);
    expect(plans[2]?.limits).toEqual(["Hasta 10 sucursales", "Hasta 3 tarjetas de lealtad"]);
    expect(plans[2]?.yearlyAmount).toBe(999000);
    expect(plans[2]?.startingAt).toBe(true);
  });

  it("ignores unknown codes, missing monthly prices and inactive or foreign prices", () => {
    const plans = buildPricingPlans([
      pkg("otro", 10000),
      pkg("inicial", 39900, {
        billing_package_prices: [
          { billing_interval: "MONTH", currency_code: "USD", amount_minor: 2000, status: "ACTIVE" },
          { billing_interval: "MONTH", currency_code: "MXN", amount_minor: 39900, status: "ARCHIVED" },
        ],
      }),
    ]);
    expect(plans).toEqual([]);
  });

  it("marks unbuilt features as coming soon so the landing never overpromises", () => {
    const soon = Object.values(PLAN_COPY).flatMap((plan) => plan.features.filter((feature) => feature.soon).map((feature) => feature.label));
    expect(soon).toEqual(expect.arrayContaining([
      "WhatsApp para clientes que no han regresado",
      "Promociones",
      "Estadísticas avanzadas",
    ]));
  });

  it("formats whole Mexican pesos", () => {
    expect(formatPesos(39900)).toBe("$399");
    expect(formatPesos(699000)).toBe("$6,990");
  });
});
