import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SignupInput } from "./signup-validation";
import {
  SELF_SERVICE_TRIAL_DAYS,
  isSelfServicePackage,
  stripeCheckoutConfig,
  stripeClient,
  type StripeConfig,
} from "./stripe";

export type SignupStartResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

const MAX_PENDING_PER_EMAIL_PER_HOUR = 5;

const ERRORS = {
  unavailable: "El alta en línea no está disponible en este momento. Escríbenos por WhatsApp y te ayudamos.",
  plan: "Ese plan no está disponible en línea.",
  existing: "Ya existe una cuenta con este correo. Inicia sesión o recupera tu acceso.",
  tooMany: "Recibimos varios intentos con este correo. Espera unos minutos e inténtalo de nuevo.",
  generic: "No pudimos iniciar el pago. Inténtalo de nuevo en unos minutos.",
} as const;

function log(scope: string, error: unknown) {
  console.error(`[self-service-signup:${scope}]`, {
    message: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
  });
}

/** Loads the ACTIVE MXN price synchronized with Stripe for a self-service plan. */
async function loadSignupPrice(db: ReturnType<typeof createSupabaseAdminClient>, input: SignupInput) {
  if (!isSelfServicePackage(input.planCode)) return null;
  const { data, error } = await db
    .from("billing_packages")
    .select("id,code,name,status,billing_package_prices(id,billing_interval,currency_code,status,stripe_price_id)")
    .eq("code", input.planCode)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (error || !data) return null;
  const price = data.billing_package_prices.find(
    (item) => item.status === "ACTIVE" && item.currency_code === "MXN"
      && item.billing_interval === input.interval && item.stripe_price_id,
  );
  return price ? { packageId: data.id, packageName: data.name, priceId: price.id, stripePriceId: price.stripe_price_id as string } : null;
}

/**
 * Reuses the auth user of an abandoned signup for the same email (no staff
 * profile yet) or creates a new one. Existing staff accounts are rejected.
 */
async function resolveAuthUser(db: ReturnType<typeof createSupabaseAdminClient>, input: SignupInput) {
  const { data: profile } = await db.from("staff_profiles").select("id").eq("email", input.email).limit(1).maybeSingle();
  if (profile) return { error: ERRORS.existing } as const;

  const { data: previous } = await db
    .from("billing_signup_intents")
    .select("auth_user_id,status,created_at")
    .eq("email", input.email)
    .order("created_at", { ascending: false })
    .limit(MAX_PENDING_PER_EMAIL_PER_HOUR + 1);
  const recent = (previous ?? []).filter((row) => Date.now() - Date.parse(row.created_at) < 60 * 60 * 1000);
  if (recent.length >= MAX_PENDING_PER_EMAIL_PER_HOUR) return { error: ERRORS.tooMany } as const;

  const reusable = (previous ?? []).find((row) => row.status !== "COMPLETED");
  if (reusable) {
    const { data: owner } = await db.from("staff_profiles").select("id").eq("id", reusable.auth_user_id).maybeSingle();
    if (owner) return { error: ERRORS.existing } as const;
    const { error } = await db.auth.admin.updateUserById(reusable.auth_user_id, {
      password: input.password,
      user_metadata: { full_name: input.fullName },
    });
    if (!error) return { userId: reusable.auth_user_id } as const;
  }

  const { data, error } = await db.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (error || !data.user) {
    return { error: /already|registered|exists/i.test(error?.message ?? "") ? ERRORS.existing : ERRORS.generic } as const;
  }
  return { userId: data.user.id } as const;
}

export async function startSelfServiceSignup(
  input: SignupInput,
  config: StripeConfig | null = stripeCheckoutConfig(),
): Promise<SignupStartResult> {
  if (!config) return { ok: false, error: ERRORS.unavailable };
  try {
    const db = createSupabaseAdminClient();
    const price = await loadSignupPrice(db, input);
    if (!price) return { ok: false, error: ERRORS.plan };

    const user = await resolveAuthUser(db, input);
    if (!("userId" in user) || !user.userId) {
      return { ok: false, error: "error" in user && user.error ? user.error : ERRORS.generic };
    }

    const { data: intent, error: intentError } = await db
      .from("billing_signup_intents")
      .insert({
        package_id: price.packageId,
        package_price_id: price.priceId,
        business_name: input.businessName,
        admin_full_name: input.fullName,
        email: input.email,
        phone: input.phone,
        auth_user_id: user.userId,
      })
      .select("id")
      .single();
    if (intentError || !intent) throw new Error(intentError?.message ?? "Intent insert failed.");

    const stripe = stripeClient(config.secretKey);
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        locale: "es",
        customer_email: input.email,
        client_reference_id: intent.id,
        line_items: [{ price: price.stripePriceId, quantity: 1 }],
        payment_method_collection: "always",
        billing_address_collection: "auto",
        // RFC captured now so CFDI invoices can be issued later (outside Stripe).
        tax_id_collection: { enabled: true },
        ...(config.tax.mode === "automatic" ? { automatic_tax: { enabled: true } } : {}),
        subscription_data: {
          trial_period_days: SELF_SERVICE_TRIAL_DAYS,
          billing_mode: { type: "flexible" },
          ...(config.tax.mode === "fixed" ? { default_tax_rates: [config.tax.ivaTaxRateId] } : {}),
          trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
          metadata: { morrow_signup_intent_id: intent.id, morrow_package_price_id: price.priceId },
        },
        metadata: { morrow_signup_intent_id: intent.id, morrow_package_price_id: price.priceId },
        success_url: `${config.publicOrigin}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.publicOrigin}/signup?plan=${encodeURIComponent(input.planCode)}&interval=${input.interval}&canceled=1`,
      },
      { idempotencyKey: `morrow-signup-${intent.id}` },
    );
    if (!session.url) throw new Error("Checkout session without URL.");

    await db.from("billing_signup_intents").update({ stripe_checkout_session_id: session.id }).eq("id", intent.id);
    return { ok: true, checkoutUrl: session.url };
  } catch (error) {
    log("start", error);
    return { ok: false, error: ERRORS.generic };
  }
}

export type SignupCompletionStatus = "COMPLETED" | "PENDING" | "UNKNOWN";

/** Browser return only reports status; activation happens in the webhook. */
export async function signupStatusForCheckoutSession(sessionId: string): Promise<SignupCompletionStatus> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return "UNKNOWN";
  try {
    const db = createSupabaseAdminClient();
    const { data } = await db
      .from("billing_signup_intents")
      .select("status")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();
    if (!data) return "UNKNOWN";
    return data.status === "COMPLETED" ? "COMPLETED" : "PENDING";
  } catch {
    return "UNKNOWN";
  }
}
