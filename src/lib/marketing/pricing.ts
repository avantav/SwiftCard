/**
 * Public pricing for the landing. Prices and limits come from the billing
 * catalog (ACTIVE packages and MXN prices); the marketing copy for each plan
 * lives here, keyed by package code. Features that are approved but not built
 * yet are flagged as `soon` so the page never promises unavailable capability.
 */

export type PricingFeature = { label: string; soon?: boolean };

export type PlanCopy = {
  tagline: string;
  features: PricingFeature[];
  ctaLabel: string;
  ctaMessage: string;
  highlighted?: boolean;
  /** Shows "Desde" before the price: the plan can be extended on request. */
  startingAt?: boolean;
};

export const PLAN_COPY: Record<string, PlanCopy> = {
  inicial: {
    tagline: "Para empezar a premiar a tus clientes frecuentes.",
    features: [
      { label: "Clientes ilimitados" },
      { label: "Apple Wallet, Google Wallet y tarjeta web" },
      { label: "App para tu equipo con escáner y PIN" },
      { label: "Avisos de compra y premios en la tarjeta" },
      { label: "Correos de bienvenida y de premio" },
    ],
    ctaLabel: "Empezar prueba de 15 días",
    ctaMessage: "Hola, quiero empezar la prueba de 15 días del plan Inicial de morrow.",
  },
  crecimiento: {
    tagline: "Para crecer a más sucursales y recuperar clientes.",
    features: [
      { label: "Todo lo del plan Inicial" },
      { label: "Validación de ubicación por sucursal" },
      { label: "WhatsApp para clientes que no han regresado", soon: true },
    ],
    ctaLabel: "Empezar prueba de 15 días",
    ctaMessage: "Hola, quiero empezar la prueba de 15 días del plan Crecimiento de morrow.",
    highlighted: true,
  },
  empresarial: {
    tagline: "Para cadenas que necesitan una solución a su medida.",
    features: [
      { label: "Todo lo del plan Crecimiento" },
      { label: "Adaptaciones a la medida de tu empresa" },
      { label: "Soporte prioritario" },
      { label: "Promociones", soon: true },
      { label: "Estadísticas avanzadas", soon: true },
    ],
    ctaLabel: "Hablar con ventas",
    ctaMessage: "Hola, me interesa el plan Empresarial de morrow para mi empresa.",
    startingAt: true,
  },
};

export type CatalogPackage = {
  code: string;
  name: string;
  branch_limit: number | null;
  loyalty_card_limit: number | null;
  membership_limit: number | null;
  billing_package_prices: Array<{
    billing_interval: "MONTH" | "YEAR";
    currency_code: string;
    amount_minor: number;
    status: string;
  }>;
};

export type PricingPlan = PlanCopy & {
  code: string;
  name: string;
  monthlyAmount: number;
  yearlyAmount: number | null;
  limits: string[];
};

const pesos = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function formatPesos(amountMinor: number) {
  return pesos.format(amountMinor / 100);
}

function limitLabel(value: number | null, singular: string, plural: string, unlimited: string) {
  if (value === null) return unlimited;
  return value === 1 ? `1 ${singular}` : `Hasta ${value} ${plural}`;
}

/** Keeps only packages with marketing copy and an active monthly MXN price, ordered by price. */
export function buildPricingPlans(packages: CatalogPackage[]): PricingPlan[] {
  return packages
    .flatMap((pkg) => {
      const copy = PLAN_COPY[pkg.code];
      const active = pkg.billing_package_prices.filter(
        (price) => price.status === "ACTIVE" && price.currency_code === "MXN",
      );
      const monthly = active.find((price) => price.billing_interval === "MONTH");
      if (!copy || !monthly) return [];
      const yearly = active.find((price) => price.billing_interval === "YEAR");
      return [{
        ...copy,
        code: pkg.code,
        name: pkg.name,
        monthlyAmount: Number(monthly.amount_minor),
        yearlyAmount: yearly ? Number(yearly.amount_minor) : null,
        limits: [
          limitLabel(pkg.branch_limit, "sucursal", "sucursales", "Sucursales ilimitadas"),
          limitLabel(pkg.loyalty_card_limit, "tarjeta de lealtad", "tarjetas de lealtad", "Tarjetas ilimitadas"),
        ],
      }];
    })
    .sort((left, right) => left.monthlyAmount - right.monthlyAmount);
}
