"use server";

import { redirect } from "next/navigation";
import { getActiveSuperadminContext } from "@/lib/auth/server";
import { validateBrandingForm } from "@/lib/superadmin/tenants";

export async function updateTenantBranding(formData: FormData) {
  const context = await getActiveSuperadminContext();
  const tenantId = String(formData.get("tenantId") ?? "");
  const validation = validateBrandingForm(formData);
  if (!context || !tenantId || !validation.ok) redirect(`/superadmin/tenants/${tenantId}/branding?error=${encodeURIComponent(validation.ok ? "No autorizado." : validation.errors[0])}`);
  const { error } = await context.supabase.rpc("update_tenant_branding", { target_tenant_id: tenantId, target_branding_mode: validation.data.brandingMode, target_logo_url: validation.data.logoUrl ?? "", target_banner_url: validation.data.bannerUrl ?? "", target_primary_color: validation.data.primaryColor, target_secondary_color: validation.data.secondaryColor });
  if (error) redirect(`/superadmin/tenants/${tenantId}/branding?error=${encodeURIComponent("No se pudo guardar el branding.")}`);
  redirect(`/superadmin/tenants/${tenantId}/branding?saved=1`);
}
