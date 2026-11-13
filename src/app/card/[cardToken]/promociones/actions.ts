"use server";

import { redirect } from "next/navigation";
import { isCustomerCardToken } from "@/lib/customers/card-qr";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";

/** Opt-out from campaign messages (email and Wallet). Requires a POST so link scanners cannot trigger it. */
export async function stopPromotions(cardToken: string) {
  if (!isCustomerCardToken(cardToken)) redirect("/");
  const supabase = createSupabasePublicServerClient();
  const { data, error } = await supabase.schema("app").rpc("set_card_marketing_consent", {
    target_card_token: cardToken,
    target_consent: false
  });
  const status = !error && data === "UPDATED" ? "done" : "error";
  redirect(`/card/${encodeURIComponent(cardToken)}/promociones?${status}=1`);
}
