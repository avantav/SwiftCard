import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildPricingPlans, type CatalogPackage, type PricingPlan } from "./pricing";

/**
 * Reads only public catalog fields of ACTIVE packages. Any failure hides the
 * pricing section instead of breaking the landing.
 */
export async function loadPublicPricingPlans(): Promise<PricingPlan[]> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from("billing_packages")
      .select("code,name,branch_limit,loyalty_card_limit,membership_limit,billing_package_prices(billing_interval,currency_code,amount_minor,status,stripe_price_id)")
      .eq("status", "ACTIVE");
    if (error || !data) return [];
    return buildPricingPlans(data as CatalogPackage[]);
  } catch {
    return [];
  }
}
