import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { billingSubscriptionBadge, billingSubscriptionLabel, getBillingUsageState } from "./summary";

const pageSource = readFileSync(new URL("../../app/admin/billing/page.tsx", import.meta.url), "utf8");
const navigationSource = readFileSync(new URL("../../components/admin-navigation.tsx", import.meta.url), "utf8");

describe("billing summary", () => {
  it("classifies unlimited and progressive membership thresholds", () => {
    expect(getBillingUsageState(900, null)).toEqual({ level: "UNLIMITED", percent: null, visualPercent: 0 });
    expect(getBillingUsageState(79, 100).level).toBe("AVAILABLE");
    expect(getBillingUsageState(80, 100).level).toBe("WARNING");
    expect(getBillingUsageState(90, 100).level).toBe("CRITICAL");
    expect(getBillingUsageState(120, 100)).toEqual({ level: "LIMIT", percent: 120, visualPercent: 100 });
  });

  it("translates subscription states and badge severity", () => {
    expect(billingSubscriptionLabel("PAST_DUE")).toBe("Pago vencido");
    expect(billingSubscriptionBadge("ACTIVE")).toBe("is-active");
    expect(billingSubscriptionBadge("CANCELED")).toBe("is-suspended");
  });

  it("derives tenant authority from the authenticated Admin context", () => {
    expect(pageSource).toContain('requireInternalArea("ADMIN")');
    expect(pageSource).toContain('context.access.role !== "ADMIN"');
    expect(pageSource).toContain("context.tenantId");
    expect(pageSource).not.toContain("createSupabaseAdminClient");
  });

  it("renders subscription, usage, capacity, promotion and affiliate states", () => {
    for (const copy of ["Aún no hay una suscripción asignada", "Uso de membresías", "Capacidad contratada", "Promoción aplicada", "Afiliado atribuido"]) expect(pageSource).toContain(copy);
  });

  it("shows billing navigation only to the general Admin", () => {
    expect(navigationSource).toContain('role === "ADMIN"');
    expect(navigationSource).toContain('href: "/admin/billing"');
  });
});
