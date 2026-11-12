import "server-only";

import { createHash } from "node:crypto";
import type Stripe from "stripe";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type SubscriptionStatus = "TRIALING" | "INCOMPLETE" | "ACTIVE" | "PAST_DUE" | "PAUSED" | "CANCELED";

export type WebhookOutcome = "PROCESSED" | "IGNORED" | "DUPLICATE";

export type WebhookDeps = {
  db: AdminClient;
  retrieveSubscription: (id: string) => Promise<Stripe.Subscription>;
};

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
]);

export function mapSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing": return "TRIALING";
    case "active": return "ACTIVE";
    case "past_due":
    case "unpaid": return "PAST_DUE";
    case "paused": return "PAUSED";
    case "incomplete": return "INCOMPLETE";
    default: return "CANCELED";
  }
}

const iso = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null);
const idOf = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : value?.id ?? null);

/** Period fields live on the subscription item in current Stripe API versions. */
function periodOf(subscription: Stripe.Subscription) {
  const item = subscription.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number }) | undefined;
  const legacy = subscription as Stripe.Subscription & { current_period_start?: number; current_period_end?: number };
  const start = item?.current_period_start ?? legacy.current_period_start ?? subscription.start_date;
  const end = item?.current_period_end ?? legacy.current_period_end ?? subscription.trial_end ?? start + 1;
  return { start: iso(start)!, end: iso(end > start ? end : start + 1)! };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const modern = (invoice as Stripe.Invoice & { parent?: { subscription_details?: { subscription?: string | { id: string } } } })
    .parent?.subscription_details?.subscription;
  const legacy = (invoice as Stripe.Invoice & { subscription?: string | { id: string } }).subscription;
  return idOf(modern ?? legacy ?? null);
}

async function tenantForCustomer(db: AdminClient, stripeCustomerId: string | null) {
  if (!stripeCustomerId) return null;
  const { data } = await db.from("billing_customers").select("tenant_id").eq("stripe_customer_id", stripeCustomerId).maybeSingle();
  return data?.tenant_id ?? null;
}

async function provisionFromIntent(db: AdminClient, intentId: string | null | undefined, stripeCustomerId: string | null) {
  if (!intentId || !/^[0-9a-f-]{36}$/i.test(intentId) || !stripeCustomerId) return null;
  const { data, error } = await db.schema("app").rpc("provision_self_service_tenant", {
    target_intent_id: intentId,
    target_stripe_customer_id: stripeCustomerId,
  });
  if (error) throw new Error(`provision_failed:${error.code ?? "unknown"}`);
  return typeof data === "string" ? data : null;
}

/**
 * A Stripe object that cannot be linked to a morrow tenant or catalog price
 * (e.g. a subscription created in the Dashboard without metadata). It is
 * recorded as IGNORED with the reason instead of being retried forever.
 */
export class UnlinkedStripeObject extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sales-led subscriptions (Empresarial via Quotes or the Dashboard) link to an
 * existing tenant through `morrow_tenant_id` metadata. An existing link to a
 * different Stripe customer is never overwritten.
 */
async function linkTenantFromMetadata(db: AdminClient, tenantId: string | undefined, stripeCustomerId: string | null) {
  if (!tenantId || !UUID.test(tenantId) || !stripeCustomerId) return null;
  const { data: tenant } = await db.from("tenants").select("id").eq("id", tenantId).maybeSingle();
  if (!tenant) return null;
  const { data: existing } = await db.from("billing_customers").select("stripe_customer_id").eq("tenant_id", tenantId).maybeSingle();
  if (existing?.stripe_customer_id && existing.stripe_customer_id !== stripeCustomerId) {
    throw new UnlinkedStripeObject("tenant_linked_to_other_customer");
  }
  const { error } = existing
    ? await db.from("billing_customers").update({ stripe_customer_id: stripeCustomerId }).eq("tenant_id", tenantId)
    : await db.from("billing_customers").insert({ tenant_id: tenantId, stripe_customer_id: stripeCustomerId });
  if (error) throw new Error(`link_failed:${error.code ?? "unknown"}`);
  return tenantId;
}

async function syncSubscription(db: AdminClient, subscription: Stripe.Subscription, latestInvoiceId: string | null = null) {
  const customerId = idOf(subscription.customer);
  let tenantId = await tenantForCustomer(db, customerId);
  if (!tenantId) tenantId = await provisionFromIntent(db, subscription.metadata?.morrow_signup_intent_id, customerId);
  if (!tenantId) tenantId = await linkTenantFromMetadata(db, subscription.metadata?.morrow_tenant_id, customerId);
  if (!tenantId) throw new UnlinkedStripeObject("tenant_not_linked");

  const stripePriceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const { data: price } = stripePriceId
    ? await db.from("billing_package_prices").select("id").eq("stripe_price_id", stripePriceId).maybeSingle()
    : { data: null };
  const packagePriceId = price?.id ?? subscription.metadata?.morrow_package_price_id ?? null;
  if (!packagePriceId || !UUID.test(packagePriceId)) throw new UnlinkedStripeObject("package_price_not_linked");

  const period = periodOf(subscription);
  const { error } = await db.schema("app").rpc("sync_stripe_subscription", {
    target_tenant_id: tenantId,
    target_package_price_id: packagePriceId,
    target_stripe_subscription_id: subscription.id,
    target_status: mapSubscriptionStatus(subscription.status),
    target_period_start: period.start,
    target_period_end: period.end,
    target_trial_ends_at: iso(subscription.trial_end),
    target_cancel_at_period_end: subscription.cancel_at_period_end,
    target_canceled_at: iso(subscription.canceled_at),
    target_ended_at: iso(subscription.ended_at),
    target_latest_invoice_id: latestInvoiceId ?? idOf(subscription.latest_invoice as string | { id: string } | null),
  });
  if (error) throw new Error(`sync_failed:${error.code ?? "unknown"}`);
}

/** Records the event once; returns false when it was already processed. */
async function claimEvent(db: AdminClient, event: Stripe.Event, rawBody: string) {
  const { data: existing } = await db
    .from("stripe_webhook_events")
    .select("id,processing_status,attempt_count")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (existing && ["PROCESSED", "IGNORED"].includes(existing.processing_status)) return null;
  if (existing) {
    await db.from("stripe_webhook_events")
      .update({ attempt_count: existing.attempt_count + 1, processing_status: "PENDING" })
      .eq("id", existing.id);
    return existing.id as string;
  }
  const { data, error } = await db
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      api_version: event.api_version,
      livemode: event.livemode,
      payload_sha256: createHash("sha256").update(rawBody).digest("hex"),
      attempt_count: 1,
    })
    .select("id")
    .single();
  if (error || !data) {
    // A concurrent delivery inserted it first; let Stripe retry later.
    throw new Error(`event_record_failed:${error?.code ?? "unknown"}`);
  }
  return data.id as string;
}

export async function processStripeEvent(event: Stripe.Event, rawBody: string, deps: WebhookDeps): Promise<WebhookOutcome> {
  const recordId = await claimEvent(deps.db, event, rawBody);
  if (!recordId) return "DUPLICATE";

  const finish = (status: "PROCESSED" | "IGNORED" | "FAILED", errorCode: string | null = null) =>
    deps.db.from("stripe_webhook_events")
      .update({ processing_status: status, last_error_code: errorCode, processed_at: status === "FAILED" ? null : new Date().toISOString() })
      .eq("id", recordId);

  if (!HANDLED.has(event.type)) {
    await finish("IGNORED");
    return "IGNORED";
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") {
        await finish("IGNORED");
        return "IGNORED";
      }
      const intentId = session.metadata?.morrow_signup_intent_id ?? session.client_reference_id;
      const customerId = idOf(session.customer as string | { id: string } | null);
      if (!(await tenantForCustomer(deps.db, customerId))) await provisionFromIntent(deps.db, intentId, customerId);
      const subscriptionId = idOf(session.subscription as string | { id: string } | null);
      if (subscriptionId) await syncSubscription(deps.db, await deps.retrieveSubscription(subscriptionId));
    } else if (event.type.startsWith("customer.subscription.")) {
      // Re-read to apply the latest state even if events arrive out of order.
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(deps.db, await deps.retrieveSubscription(subscription.id));
    } else {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) {
        await finish("IGNORED");
        return "IGNORED";
      }
      await syncSubscription(deps.db, await deps.retrieveSubscription(subscriptionId), invoice.id ?? null);
    }
    await finish("PROCESSED");
    return "PROCESSED";
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 80) : "unknown";
    if (error instanceof UnlinkedStripeObject) {
      // Not ours (or not linked yet): acknowledge so Stripe stops retrying.
      await finish("IGNORED", code);
      return "IGNORED";
    }
    await finish("FAILED", code);
    throw error;
  }
}
