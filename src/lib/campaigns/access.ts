import "server-only";

import type { requireInternalArea } from "@/lib/auth/server";
import { supportReadParams } from "@/lib/auth/support-read";

type Context = Awaited<ReturnType<typeof requireInternalArea>>;

export type CampaignAccess = "ALLOWED" | "SUPPORT_READ" | "NOT_ADMIN" | "SUPPORT" | "NOT_EMPRESARIAL";

/**
 * Campaigns: Admin general of a tenant with Empresarial (DEC-0068). Support
 * mode can read history and details but never send (DEC-0071).
 */
export async function campaignAccess(context: Context): Promise<CampaignAccess> {
  if (!context.supportSession && context.access.role !== "ADMIN") return "NOT_ADMIN";
  const { data, error } = await context.supabase.schema("app").rpc("current_tenant_campaigns_available", supportReadParams(context));
  if (error || data !== true) return "NOT_EMPRESARIAL";
  return context.supportSession ? "SUPPORT_READ" : "ALLOWED";
}

/** Pages that only read (history, detail) accept support mode. */
export function canReadCampaigns(access: CampaignAccess): access is "ALLOWED" | "SUPPORT_READ" {
  return access === "ALLOWED" || access === "SUPPORT_READ";
}

export const ACCESS_COPY: Record<Exclude<CampaignAccess, "ALLOWED">, { title: string; body: string }> = {
  SUPPORT_READ: { title: "Solo lectura en modo soporte", body: "Puedes consultar el historial y el detalle de las campañas, pero no enviar campañas: llegan a clientes reales." },
  NOT_ADMIN: { title: "Disponible para el Admin general", body: "Solo el Admin general del negocio puede crear y consultar campañas." },
  SUPPORT: { title: "No disponible en modo soporte", body: "Las campañas se envían a clientes reales y no se envían desde soporte." },
  NOT_EMPRESARIAL: { title: "Campañas del plan Empresarial", body: "Envía mensajes por correo y Wallet a segmentos de clientes, como los que están en riesgo o los perdidos. Escríbenos por WhatsApp para activar el plan Empresarial." }
};
