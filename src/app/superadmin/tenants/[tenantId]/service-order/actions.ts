"use server";

import { redirect } from "next/navigation";
import { getActiveSuperadminContext } from "@/lib/auth/server";
import { validateServiceOrderForm } from "@/lib/billing/service-orders";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Issues a new Service Order version for a tenant (DEC-0076). Superadmin only. */
export async function createServiceOrder(formData: FormData) {
  const context = await getActiveSuperadminContext();
  const tenantId = String(formData.get("tenantId") ?? "");
  if (!context || !UUID.test(tenantId)) redirect("/superadmin");
  const base = `/superadmin/tenants/${tenantId}/service-order`;
  const validation = validateServiceOrderForm(formData);
  if (!validation.ok) redirect(`${base}?error=${encodeURIComponent(validation.error)}`);
  const order = validation.data;
  const { error } = await context.supabase.schema("app").rpc("create_tenant_service_order", {
    target_tenant_id: tenantId,
    target_plan_name: order.planName,
    target_price_minor: order.priceMinor,
    target_currency_code: order.currencyCode,
    target_billing_interval: order.billingInterval,
    target_included_scope: order.includedScope,
    target_excluded_scope: order.excludedScope,
    target_starts_on: order.startsOn,
    target_ends_on: order.endsOn,
  });
  if (error) redirect(`${base}?error=${encodeURIComponent("No se pudo crear la Orden de Servicio.")}`);
  redirect(`${base}?saved=1`);
}
