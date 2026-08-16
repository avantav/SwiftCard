import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseCardQrPayload } from "./qr";

const token = "AbcdefghijKLMNOPqrstuvwxyz0123456789-_ABCDE";

describe("parseCardQrPayload", () => {
  it("accepts a card URL and raw token", () => {
    expect(parseCardQrPayload(`https://swiftwallet.test/card/${token}`)).toEqual({ ok: true, cardToken: token });
    expect(parseCardQrPayload(token)).toEqual({ ok: true, cardToken: token });
  });

  it("rejects unrelated URLs and malformed tokens", () => {
    expect(parseCardQrPayload("https://swiftwallet.test/register/branch")).toMatchObject({ ok: false });
    expect(parseCardQrPayload("short-token")).toMatchObject({ ok: false });
  });

  it("connects the operational scanner to the rear camera without exposing manual QR input", () => {
    const scanner = readFileSync(
      new URL("../../components/customer-card-scanner.tsx", import.meta.url),
      "utf8",
    );
    const page = readFileSync(
      new URL("../../app/app/scan/page.tsx", import.meta.url),
      "utf8",
    );
    const searchModal = readFileSync(
      new URL("../../components/customer-search-modal.tsx", import.meta.url),
      "utf8",
    );
    const detailsModal = readFileSync(
      new URL("../../components/customer-details-modal.tsx", import.meta.url),
      "utf8",
    );
    const actions = readFileSync(
      new URL("../../app/app/scan/actions.ts", import.meta.url),
      "utf8",
    );

    expect(scanner).toContain("BrowserQRCodeReader");
    expect(scanner).toContain("decodeFromConstraints");
    expect(scanner).toContain('facingMode: { ideal: "environment" }');
    expect(scanner).toContain("requestSubmit()");
    expect(scanner).toContain("activeControls.stop()");
    expect(scanner).toContain('type="hidden"');
    expect(scanner).not.toContain("Captura manual");
    expect(scanner).not.toContain("Código o enlace de la tarjeta");
    expect(scanner).toContain("navigator.onLine");
    expect(page).toContain("customerCardId");
    expect(page).toContain("loyaltyCardId");
    expect(page).toContain("CustomerSearchModal");
    expect(searchModal).toContain("showModal()");
    expect(searchModal).toContain("Buscar cliente por nombre o teléfono");
    expect(searchModal).toContain('aria-haspopup="dialog"');
    expect(searchModal).toContain("operations-search-dialog-body");
    expect(detailsModal).toContain("showModal()");
    expect(detailsModal).toContain('href="/app/scan"');
    expect(page).toContain("CustomerDetailsModal");
    expect(page).toContain("Premios disponibles");
    expect(page).toContain("Registrar compra");
    expect(actions).toContain('redirect(`/app/scan?');
    expect(actions).toContain("redeemCustomerReward");
  });
});
