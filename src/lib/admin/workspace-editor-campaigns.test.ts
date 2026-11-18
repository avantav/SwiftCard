import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateCampaignForm } from "@/lib/campaigns/form";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const read = (path: string) => readFileSync(path, "utf8");

describe("phase 3: card editor and campaigns keep input (DEC-0073)", () => {
  it("reports the field of each campaign validation error", () => {
    expect(validateCampaignForm(form({ name: "Recuperar", segments: "AT_RISK", sendWallet: "on", walletMessage: "Visita https://example.com" }))).toMatchObject({ ok: false, field: "walletMessage" });
    expect(validateCampaignForm(form({ name: "", segments: "AT_RISK" }))).toMatchObject({ ok: false, field: "name" });
    expect(validateCampaignForm(form({ name: "Recuperar", segments: "AT_RISK" }))).toMatchObject({ ok: false, field: "channels" });
  });

  it("returns campaign errors as state and keeps the audience in the form", () => {
    const actions = read("src/app/admin/campaigns/actions.ts");
    const content = read("src/components/campaign-content-form.tsx");
    expect(actions).toContain("Promise<CampaignActionState>");
    expect(actions).not.toContain("function back(");
    expect(content).toContain('<input name="branchId" type="hidden" value={branchId} />');
    expect(content).toContain("defaultValue={values.emailBody}");
  });

  it("saves editor steps without resetting the form and honors upload vetoes", () => {
    const editor = read("src/app/admin/cards/[cardId]/edit/page.tsx");
    const preserving = read("src/components/admin/preserving-form.tsx");
    const actions = read("src/app/admin/cards/actions.ts");
    expect(editor.match(/<PreservingForm /g)).toHaveLength(3);
    expect(actions).toContain("export async function saveCardDesign(cardId: string, _previousState: CardStepState, formData: FormData): Promise<CardStepState>");
    expect(actions).toContain("return cardStepError(");
    expect(preserving).toContain("event.nativeEvent.defaultPrevented");
    expect(preserving).toContain("new FormData(event.currentTarget, submitter)");
    expect(preserving).not.toContain("<form action=");
  });
});
