"use server";

import { redirect } from "next/navigation";
import { withNotice } from "@/lib/forms/notices";
import { requireInternalArea } from "@/lib/auth/server";
import { stripeCheckoutConfig, stripeClient } from "@/lib/billing/stripe";

/**
 * Opens the Stripe Customer Portal for the signed-in general Administrator's
 * own tenant. The tenant and Stripe customer are derived from the session and
 * RLS, never from the browser.
 */
export async function openBillingPortal() {
  const context = await requireInternalArea("ADMIN", { writable: true });
  if (context.access.role !== "ADMIN" || !context.tenantId) redirect("/admin");

  const config = stripeCheckoutConfig();
  const { data: customer } = await context.supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("tenant_id", context.tenantId)
    .maybeSingle();
  if (!config || !customer?.stripe_customer_id) redirect("/admin/billing?portal=unavailable");

  let url: string | null = null;
  try {
    const session = await stripeClient(config.secretKey).billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      locale: "es",
      return_url: `${config.publicOrigin}/admin/billing`,
    });
    url = session.url;
  } catch (error) {
    console.error("[billing-portal]", { message: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
  }
  redirect(url ?? "/admin/billing?portal=error");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The Admin general accepts the latest Service Order of its own tenant
 * (DEC-0076). Support sessions are read-only and cannot accept.
 */
export async function acceptServiceOrder(orderId: string, formData: FormData) {
  const context = await requireInternalArea("ADMIN", { writable: true });
  if (context.access.role !== "ADMIN" || !context.tenantId) redirect("/admin");
  if (!UUID.test(orderId) || formData.get("conformity") !== "on") redirect("/admin/billing?order=invalid");
  const { data, error } = await context.supabase.schema("app").rpc("accept_my_service_order", { target_order_id: orderId });
  if (error || (data !== "ACCEPTED" && data !== "ALREADY_ACCEPTED")) {
    redirect(`/admin/billing?order=${data === "SUPERSEDED" ? "superseded" : "error"}`);
  }
  redirect(withNotice("/admin/billing", "service_order_accepted"));
}
