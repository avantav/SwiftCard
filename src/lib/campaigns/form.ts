import { isSegment, type Segment } from "@/lib/admin/insights";
import type { FormState } from "@/lib/forms/state";

/** Campaign form limits; mirrored by marketing_campaigns constraints (0076). */
export const CAMPAIGN_LIMITS = { name: 80, subject: 120, body: 1500, wallet: 120 } as const;

export type CampaignInput = {
  name: string;
  segments: Segment[];
  branchId: string | null;
  sendEmail: boolean;
  emailSubject: string;
  emailBody: string;
  sendWallet: boolean;
  walletMessage: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
}

export function parseSegments(values: Array<string | string[] | FormDataEntryValue | undefined | null>) {
  const flat = values.flatMap((value) => (Array.isArray(value) ? value : [value]));
  return [...new Set(flat.filter((value): value is Segment => isSegment(value)))];
}

export type CampaignField = "name" | "segments" | "channels" | "emailSubject" | "emailBody" | "walletMessage" | "confirmSend";

export type CampaignFormValues = {
  name: string;
  sendEmail: boolean;
  emailSubject: string;
  emailBody: string;
  sendWallet: boolean;
  walletMessage: string;
};

/** Message step of a new campaign; keeps what was typed on errors (DEC-0073). */
export type CampaignActionState = FormState<CampaignFormValues, CampaignField>;

export function campaignFormValues(formData: FormData): CampaignFormValues {
  return {
    name: text(formData, "name"),
    sendEmail: formData.get("sendEmail") === "on",
    emailSubject: text(formData, "emailSubject"),
    emailBody: text(formData, "emailBody"),
    sendWallet: formData.get("sendWallet") === "on",
    walletMessage: text(formData, "walletMessage"),
  };
}

export function validateCampaignForm(formData: FormData):
  | { ok: true; data: CampaignInput }
  | { ok: false; error: string; field: CampaignField } {
  const name = text(formData, "name");
  const segments = parseSegments(formData.getAll("segments"));
  const branch = text(formData, "branchId");
  const sendEmail = formData.get("sendEmail") === "on";
  const sendWallet = formData.get("sendWallet") === "on";
  const emailSubject = text(formData, "emailSubject");
  const emailBody = text(formData, "emailBody");
  const walletMessage = text(formData, "walletMessage").replace(/\s+/g, " ");

  if (!name || name.length > CAMPAIGN_LIMITS.name) return { ok: false, field: "name", error: "Escribe un nombre interno de hasta 80 caracteres." };
  if (!segments.length) return { ok: false, field: "segments", error: "Elige al menos un segmento." };
  if (!sendEmail && !sendWallet) return { ok: false, field: "channels", error: "Elige al menos un canal: correo o Wallet." };
  if (sendEmail && (!emailSubject || emailSubject.length > CAMPAIGN_LIMITS.subject)) return { ok: false, field: "emailSubject", error: "El asunto del correo es obligatorio (máximo 120 caracteres)." };
  if (sendEmail && (!emailBody || emailBody.length > CAMPAIGN_LIMITS.body)) return { ok: false, field: "emailBody", error: "El mensaje del correo es obligatorio (máximo 1,500 caracteres)." };
  if (sendWallet && (!walletMessage || walletMessage.length > CAMPAIGN_LIMITS.wallet)) return { ok: false, field: "walletMessage", error: "El aviso de Wallet es obligatorio (máximo 120 caracteres)." };
  if (/https?:\/\//i.test(walletMessage)) return { ok: false, field: "walletMessage", error: "El aviso de Wallet no puede incluir enlaces." };

  return {
    ok: true,
    data: {
      name,
      segments,
      branchId: UUID.test(branch) ? branch : null,
      sendEmail,
      emailSubject: sendEmail ? emailSubject : "",
      emailBody: sendEmail ? emailBody : "",
      sendWallet,
      walletMessage: sendWallet ? walletMessage : ""
    }
  };
}

export type CampaignPreview = {
  customers: number;
  without_consent: number;
  capped: number;
  email: number;
  wallet: number;
  apple: number;
  google: number;
};
