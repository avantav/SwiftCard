import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const migration = source("../../../supabase/migrations/0045_staff_program_catalog.sql");
const navigation = source("../../components/operations-navigation.tsx");
const programPage = source("../../app/app/program/page.tsx");
const scanPage = source("../../app/app/scan/page.tsx");

describe("employee customer and program flow", () => {
  it("derives customer and program reads from the authenticated staff context", () => {
    expect(migration).toContain("function app.get_staff_program_catalog()");
    expect(migration).toContain("function app.get_staff_customer_card_summary(target_customer_card_id uuid)");
    expect(migration).toContain("staff.id = auth.uid()");
    expect(migration).toContain("issued.tenant_id = staff.tenant_id");
    expect(migration).toContain("app.current_staff_can_access_branch(branch.id)");
    expect(migration).not.toContain("target_tenant_id");
    expect(migration).toContain("revoke all on function app.get_staff_program_catalog()");
  });

  it("keeps the operational navigation to the three requested destinations", () => {
    expect(navigation).toContain('{ href: "/app", label: "Registro"');
    expect(navigation).toContain('{ href: "/app/scan", label: "Clientes"');
    expect(navigation).toContain('{ href: "/app/program", label: "Programa"');
    expect(navigation).not.toContain('label: "Compra"');
    expect(navigation).not.toContain('label: "Canje"');
    expect(navigation).toContain('["/app/scan", "/app/purchase", "/app/redeem"]');
  });

  it("shows rewards and terms in the program tab and customer actions in one modal", () => {
    expect(programPage).toContain("Catálogo de premios");
    expect(programPage).toContain("Términos y condiciones");
    expect(programPage).toContain("Cómo acumular");
    expect(scanPage).toContain("operations-customer-summary");
    expect(scanPage).toContain("redeemCustomerReward");
    expect(scanPage).toContain("Registrar compra");
  });
});
