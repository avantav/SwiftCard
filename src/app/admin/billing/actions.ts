"use server";

import { redirect } from "next/navigation";
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
