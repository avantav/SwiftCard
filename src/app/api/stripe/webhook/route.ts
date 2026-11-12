import { NextResponse, type NextRequest } from "next/server";
import { stripeCheckoutConfig, stripeClient } from "@/lib/billing/stripe";
import { processStripeEvent } from "@/lib/billing/stripe-webhook";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 512 * 1024;

function reply(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Stripe webhook: verifies the signature over the raw body, records the event
 * idempotently and mirrors subscriptions. Non-2xx responses make Stripe retry.
 */
export async function POST(request: NextRequest) {
  const config = stripeCheckoutConfig();
  if (!config?.webhookSecret) return reply(503, { error: "Stripe webhook is not configured." });

  const signature = request.headers.get("stripe-signature");
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (!signature || declaredLength > MAX_BODY_BYTES) return reply(400, { error: "Invalid request." });

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) return reply(400, { error: "Invalid request." });

  const stripe = stripeClient(config.secretKey);
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
  } catch {
    return reply(400, { error: "Invalid signature." });
  }

  try {
    const outcome = await processStripeEvent(event, rawBody, {
      db: createSupabaseAdminClient(),
      retrieveSubscription: (id) => stripe.subscriptions.retrieve(id),
    });
    return reply(200, { received: true, outcome });
  } catch (error) {
    console.error("[stripe-webhook]", {
      eventId: event.id,
      type: event.type,
      message: error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
    return reply(500, { error: "Processing failed." });
  }
}
