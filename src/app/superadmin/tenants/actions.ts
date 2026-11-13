"use server";

import { redirect } from "next/navigation";
import { getActiveSuperadminContext } from "@/lib/auth/server";
import { dispatchAppleWalletUpdatesBestEffort } from "@/lib/wallet/apple-apns";

export async function setTenantStatus(formData: FormData) {
  const context = await getActiveSuperadminContext();
  const tenantId = String(formData.get("tenantId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!context || !tenantId || !["ACTIVE", "SUSPENDED"].includes(status)) redirect("/superadmin?error=Datos+de+tenant+inválidos");
  const { error } = await context.supabase.rpc("set_tenant_status", { target_tenant_id: tenantId, target_status: status });
  if (error) redirect(`/superadmin?error=${encodeURIComponent("No se pudo cambiar el estado del tenant.")}`);
  await dispatchAppleWalletUpdatesBestEffort({ limit: 25, tenantId });
  redirect(`/superadmin?tenantStatus=${status}`);
}

/** Campaigns for tenants without an Empresarial subscription record (DEC-0068). */
export async function setTenantCampaigns(formData: FormData) {
  const context = await getActiveSuperadminContext();
  const tenantId = String(formData.get("tenantId") ?? "");
  const enabled = formData.get("enabled") === "true";
  if (!context || !/^[0-9a-f-]{36}$/i.test(tenantId)) redirect("/superadmin?error=Datos+de+tenant+inválidos");
  const { data, error } = await context.supabase.schema("app").rpc("set_tenant_campaigns_enabled", {
    target_tenant_id: tenantId,
    target_enabled: enabled
  });
  if (error || data !== true) redirect(`/superadmin?error=${encodeURIComponent("No se pudieron actualizar las campañas del tenant.")}`);
  redirect(`/superadmin?tenantCampaigns=${enabled ? "on" : "off"}`);
}
