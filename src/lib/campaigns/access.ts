import "server-only";

import type { requireInternalArea } from "@/lib/auth/server";

type Context = Awaited<ReturnType<typeof requireInternalArea>>;

export type CampaignAccess = "ALLOWED" | "NOT_ADMIN" | "SUPPORT" | "NOT_EMPRESARIAL";

/** Campaigns: Admin general of a tenant with Empresarial (DEC-0068). */
export async function campaignAccess(context: Context): Promise<CampaignAccess> {
  if (context.supportSession) return "SUPPORT";
  if (context.access.role !== "ADMIN") return "NOT_ADMIN";
  const { data, error } = await context.supabase.schema("app").rpc("current_tenant_campaigns_available");
  return !error && data === true ? "ALLOWED" : "NOT_EMPRESARIAL";
}

export const ACCESS_COPY: Record<Exclude<CampaignAccess, "ALLOWED">, { title: string; body: string }> = {
  NOT_ADMIN: { title: "Disponible para el Admin general", body: "Solo el Admin general del negocio puede crear y consultar campañas." },
  SUPPORT: { title: "No disponible en modo soporte", body: "Las campañas se envían a clientes reales y no se gestionan desde soporte." },
  NOT_EMPRESARIAL: { title: "Campañas del plan Empresarial", body: "Envía mensajes por correo y Wallet a segmentos de clientes, como los que están en riesgo o los perdidos. Escríbenos por WhatsApp para activar el plan Empresarial." }
};
