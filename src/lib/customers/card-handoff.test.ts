import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const employeeAction = source("../../app/app/register/actions.ts");
const employeePage = source("../../app/app/page.tsx");
const handoffOrigin = source("card-handoff-origin.ts");
const handoff = source("../../components/employee-registration-handoff.tsx");
const scanPage = source("../../app/app/scan/page.tsx");
const searchDelivery = source("../../components/customer-wallet-qr-delivery.tsx");
const claimPage = source("../../app/card/[cardToken]/page.tsx");
const claimAction = source("../../app/card/[cardToken]/actions.ts");
const claimComponent = source("../../components/customer-card-claim.tsx");
const appleRoute = source("../../app/api/wallet/apple/[cardToken]/route.ts");
const migration = source("../../../supabase/migrations/0046_customer_card_terms_acceptance.sql");
const staffDeliveryMigration = source("../../../supabase/migrations/0047_staff_customer_wallet_delivery.sql");

describe("employee customer card handoff", () => {
  it("returns successful employee registration to the real app route and shows a claim QR", () => {
    expect(employeeAction).toContain("redirect(`/app?");
    expect(employeeAction).not.toContain("/app/register?");
    expect(employeePage).toContain("EmployeeRegistrationHandoff");
    expect(employeePage).toContain("resolveCustomerCardHandoffOrigin");
    expect(handoffOrigin).toContain('requestHeaders.get("host")');
    expect(handoff).toContain("createCustomerCardClaimQrDataUrl(origin, cardToken)");
    expect(handoff).toContain("Revisar y aceptar los términos");
    expect(handoff).toContain("Agregar la tarjeta al teléfono");
  });

  it("keeps claim, terms and wallet handoff on one mobile page", () => {
    expect(claimPage).toContain('query.claim === "1"');
    expect(claimPage).toContain("CustomerCardClaim");
    expect(claimComponent).toContain("Términos y condiciones");
    expect(claimComponent).toContain('name="acceptTerms"');
    expect(claimComponent).toContain("Aceptar y agregar a Apple Wallet");
    expect(claimAction).toContain("accept_public_card_terms");
  });

  it("persists a versioned immutable snapshot and blocks Wallet before acceptance", () => {
    expect(migration).toContain("create table public.customer_card_terms_acceptances");
    expect(migration).toContain("terms_snapshot text not null");
    expect(migration).toContain("program_version integer not null");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("target_program_version integer");
    expect(migration).not.toContain("target_tenant_id");
    expect(appleRoute).toContain("public_card_terms_are_accepted");
    expect(appleRoute).toContain("termsAccepted !== true");
  });

  it("offers the same claim QR after search only when Wallet has no device registration", () => {
    expect(staffDeliveryMigration).toContain("function app.get_staff_customer_wallet_delivery");
    expect(staffDeliveryMigration).toContain("public.apple_wallet_registrations");
    expect(staffDeliveryMigration).toContain("app.get_staff_customer_card_summary");
    expect(staffDeliveryMigration).not.toContain("target_tenant_id");
    expect(scanPage).toContain("get_staff_customer_wallet_delivery");
    expect(scanPage).toContain("walletDelivery?.apple_wallet_added");
    expect(scanPage).toContain("CustomerWalletQrDelivery");
    expect(searchDelivery).toContain("Generar QR para agregar tarjeta");
    expect(searchDelivery).toContain("customerCardClaimPath");
  });
});
