import "server-only";

import Stripe from "stripe";
import { resolvePublicOrigin } from "@/lib/public-origin";
import { SIGNUP_PLAN_CODES } from "./signup-validation";

/** Plans customers can buy without sales contact. Empresarial is negotiated. */
export const SELF_SERVICE_PACKAGE_CODES = SIGNUP_PLAN_CODES;
export const SELF_SERVICE_TRIAL_DAYS = 30;

/**
 * IVA handling: `automatic` uses Stripe Tax (requires the head office address
 * and a Mexico registration in Stripe Tax); `fixed` applies the exclusive
 * IVA 16% tax rate created by the catalog sync.
 */
export type StripeTaxConfig =
  | { mode: "automatic" }
  | { mode: "fixed"; ivaTaxRateId: string };

export type StripeConfig = {
  secretKey: string;
  webhookSecret: string | null;
  tax: StripeTaxConfig;
  publicOrigin: string;
};

function taxConfig(env: Record<string, string | undefined>): StripeTaxConfig | null {
  const mode = env.STRIPE_TAX_MODE?.trim().toLowerCase();
  const ivaTaxRateId = env.STRIPE_IVA_TAX_RATE_ID?.trim() ?? "";
  if (mode === "automatic") return { mode: "automatic" };
  if (/^txr_[A-Za-z0-9]+$/.test(ivaTaxRateId) && (!mode || mode === "fixed")) {
    return { mode: "fixed", ivaTaxRateId };
  }
  return null;
}

/** Returns the configuration only when every value needed for checkout is valid. */
export function stripeCheckoutConfig(env: Record<string, string | undefined> = process.env): StripeConfig | null {
  const secretKey = env.STRIPE_SECRET_KEY?.trim() ?? "";
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim() || null;
  const publicOrigin = resolvePublicOrigin(env.SWIFTWALLET_PUBLIC_URL);
  const tax = taxConfig(env);
  if (!/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(secretKey) || !tax || !publicOrigin) {
    return null;
  }
  return { secretKey, webhookSecret, tax, publicOrigin };
}

let cachedClient: { key: string; client: Stripe } | null = null;

export function stripeClient(secretKey: string) {
  if (cachedClient?.key === secretKey) return cachedClient.client;
  const client = new Stripe(secretKey, {
    appInfo: { name: "morrow" },
    maxNetworkRetries: 2,
    timeout: 15_000,
  });
  cachedClient = { key: secretKey, client };
  return client;
}

export function isSelfServicePackage(code: string) {
  return (SELF_SERVICE_PACKAGE_CODES as readonly string[]).includes(code);
}
