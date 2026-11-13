"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireInternalArea } from "@/lib/auth/server";
import { deliverCampaign } from "@/lib/campaigns/delivery";
import { validateCampaignForm } from "@/lib/campaigns/form";

function back(segments: string[], branchId: string | null, error: string): never {
  const params = new URLSearchParams();
  for (const segment of segments) params.append("segments", segment);
  if (branchId) params.set("branch", branchId);
  params.set("error", error);
  redirect(`/admin/campaigns/nueva?${params.toString()}`);
}

const ERRORS: Record<string, string> = {
  "55P03": "Espera un minuto antes de enviar otra campaña.",
  "54000": "La audiencia supera 5,000 clientes. Elige menos segmentos o una sucursal.",
  "22023": "Ningún cliente cumple las condiciones: revisa segmentos, consentimiento y el límite de 7 días.",
  "42501": "Las campañas están disponibles solo para el plan Empresarial."
};

export async function createCampaign(formData: FormData) {
  const context = await requireInternalArea("ADMIN", { writable: true });
  if (context.access.role !== "ADMIN") redirect("/admin");
  const validation = validateCampaignForm(formData);
  if (!validation.ok) {
    back(formData.getAll("segments").map(String), null, validation.error);
  }
  const input = validation.data;
  if (formData.get("confirmSend") !== "on") {
    back(input.segments, input.branchId, "Confirma que deseas enviar la campaña.");
  }

  const { data, error } = await context.supabase.schema("app").rpc("create_marketing_campaign", {
    target_name: input.name,
    target_segments: input.segments,
    target_branch_id: input.branchId,
    target_send_email: input.sendEmail,
    target_email_subject: input.emailSubject,
    target_email_body: input.emailBody,
    target_send_wallet: input.sendWallet,
    target_wallet_message: input.walletMessage
  });
  if (error || typeof data !== "string") {
    back(input.segments, input.branchId, ERRORS[error?.code ?? ""] ?? "No se pudo crear la campaña. Intenta nuevamente.");
  }

  const campaignId = data;
  after(() => deliverCampaign(campaignId));
  redirect(`/admin/campaigns/${campaignId}?created=1`);
}

export async function retryCampaign(campaignId: string) {
  const context = await requireInternalArea("ADMIN", { writable: true });
  if (context.access.role !== "ADMIN") redirect("/admin");
  const { data } = await context.supabase.from("marketing_campaigns").select("id").eq("id", campaignId).maybeSingle();
  if (!data) redirect("/admin/campaigns");
  after(() => deliverCampaign(campaignId));
  redirect(`/admin/campaigns/${campaignId}?retried=1`);
}
