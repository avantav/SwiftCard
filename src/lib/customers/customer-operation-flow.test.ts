import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const scanPage = source("../../app/app/scan/page.tsx");
const scanActions = source("../../app/app/scan/actions.ts");
const detailsModal = source("../../components/customer-details-modal.tsx");
const styles = source("../../app/globals.css");

describe("guided customer operations", () => {
  it("keeps customer summary, purchase and reward work in one three-step modal", () => {
    expect(detailsModal).toContain("Paso {currentStep} de {totalSteps}");
    expect(detailsModal).toContain("operations-step-progress");
    expect(scanPage).toContain('flow: "purchase"');
    expect(scanPage).toContain('flow: "reward"');
    expect(scanPage).toContain("Selecciona premio y sucursal");
    expect(scanPage).toContain("Confirma el canje");
    expect(scanPage).toContain("Captura los datos");
    expect(scanPage).toContain("Revisa la compra");
    expect(scanPage).not.toContain("/app/purchase?");
  });

  it("previews and confirms purchases through backend-authoritative actions", () => {
    expect(scanActions).toContain("previewCustomerPurchase");
    expect(scanActions).toContain("preview_card_purchase");
    expect(scanActions).toContain("confirmCustomerPurchase");
    expect(scanActions).toContain("confirm_card_purchase");
    expect(scanActions).toContain("parsePurchaseAmount");
    expect(scanActions).toContain("DUPLICATE_TICKET");
  });

  it("keeps large customer result sets readable inside the bounded search modal", () => {
    expect(scanPage).toContain("clientes encontrados");
    expect(scanPage).toContain("Verifica nombre, teléfono y tarjeta");
    expect(scanPage).toContain("Seleccionar cliente");
    expect(scanPage).toContain("operations-result-card-name");
    expect(styles).toContain(".operations-search-form");
    expect(styles).toContain("position: sticky");
    expect(styles).toContain(".operations-results-heading");
  });
});
