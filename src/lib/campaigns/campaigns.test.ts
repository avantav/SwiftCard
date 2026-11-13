import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderCampaignEmail } from "@/lib/email/templates";
import { composeWalletActivityMessage } from "@/lib/wallet/activity-message";
import { parseSegments, validateCampaignForm } from "./form";

function form(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

const valid = {
  name: "Recuperar noviembre",
  segments: ["AT_RISK", "LOST", "VIP"],
  branchId: "nope",
  sendEmail: "on",
  emailSubject: "Te extrañamos",
  emailBody: "Vuelve esta semana.\r\nTe esperamos.",
  sendWallet: "on",
  walletMessage: "  Te   extrañamos esta semana  "
};

describe("validateCampaignForm", () => {
  it("normalizes a valid campaign and drops unknown segments", () => {
    expect(validateCampaignForm(form(valid))).toEqual({
      ok: true,
      data: {
        name: "Recuperar noviembre",
        segments: ["AT_RISK", "LOST"],
        branchId: null,
        sendEmail: true,
        emailSubject: "Te extrañamos",
        emailBody: "Vuelve esta semana.\nTe esperamos.",
        sendWallet: true,
        walletMessage: "Te extrañamos esta semana"
      }
    });
  });

  it("requires segments, a channel and content within limits", () => {
    expect(validateCampaignForm(form({ ...valid, segments: [] }))).toMatchObject({ ok: false });
    expect(validateCampaignForm(form({ ...valid, sendEmail: "", sendWallet: "" }))).toMatchObject({ ok: false, error: "Elige al menos un canal: correo o Wallet." });
    expect(validateCampaignForm(form({ ...valid, emailSubject: "" }))).toMatchObject({ ok: false });
    expect(validateCampaignForm(form({ ...valid, walletMessage: "x".repeat(121) }))).toMatchObject({ ok: false });
    expect(validateCampaignForm(form({ ...valid, walletMessage: "Visita https://example.com" }))).toMatchObject({ ok: false, error: "El aviso de Wallet no puede incluir enlaces." });
  });

  it("ignores content of a channel that is not selected", () => {
    const result = validateCampaignForm(form({ ...valid, sendWallet: "", walletMessage: "" }));
    expect(result).toMatchObject({ ok: true, data: { sendWallet: false, walletMessage: "" } });
  });

  it("parses segments from query strings", () => {
    expect(parseSegments([["NEW", "NEW", "LOST"], "x", undefined])).toEqual(["NEW", "LOST"]);
  });
});

describe("campaign channels", () => {
  const brand = { tenantName: "Café Norte", logoUrl: null, backgroundColor: "#1F3A2E", showMorrowAttribution: true };

  it("always includes the opt-out link and escapes content", () => {
    const email = renderCampaignEmail({
      brand,
      customerName: "Ana López",
      subject: "Te <b>extrañamos</b>",
      body: "Línea 1\nLínea 2 <script>",
      cardUrl: "https://swiftycards.com/card/token",
      unsubscribeUrl: "https://swiftycards.com/card/token/promociones"
    });
    expect(email.subject).toBe("Te <b>extrañamos</b>");
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>extrañamos</b>");
    expect(email.html).toContain('href="https://swiftycards.com/card/token/promociones"');
    expect(email.html).toContain("Dejar de recibir promociones");
    expect(email.html).toContain("Hola Ana,");
    expect(email.text).toContain("Dejar de recibir promociones: https://swiftycards.com/card/token/promociones");
  });

  it("shows the campaign as the pass's latest activity with a stable key", () => {
    const message = composeWalletActivityMessage(
      { kind: "CAMPAIGN", id: "c1", occurredAt: "2026-11-13T00:00:00Z", message: "Te extrañamos esta semana" },
      { balance: 0, availableRewards: 0, rewardGoal: null, rewardTiers: [], unitNameSingular: "sello", unitNamePlural: "sellos" }
    );
    expect(message).toEqual({ kind: "CAMPAIGN", eventKey: "campaign-c1", title: "Mensaje para ti", body: "Te extrañamos esta semana" });
  });
});

describe("campaign boundaries", () => {
  const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

  it("gates every campaign page on Empresarial access", () => {
    for (const path of ["../../app/admin/campaigns/page.tsx", "../../app/admin/campaigns/nueva/page.tsx", "../../app/admin/campaigns/[campaignId]/page.tsx"]) {
      expect(source(path)).toContain("campaignAccess(context)");
    }
    expect(source("./access.ts")).toContain('rpc("current_tenant_campaigns_available", supportReadParams(context))');
  });

  it("only opts out on POST", () => {
    const page = source("../../app/card/[cardToken]/promociones/page.tsx");
    expect(page).toContain("<form action={action}>");
    expect(page).not.toContain("set_card_marketing_consent");
    expect(source("../../app/card/[cardToken]/promociones/actions.ts")).toContain("target_consent: false");
  });

  it("requires explicit confirmation before sending", () => {
    expect(source("../../app/admin/campaigns/actions.ts")).toContain('formData.get("confirmSend") !== "on"');
  });
});
