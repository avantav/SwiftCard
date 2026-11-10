import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadGoogleWalletPassSource } from "./google-pass-source";
import { addGoogleWalletMessage, syncGoogleWalletPass } from "./google-server";
import { walletProviderConfig } from "./service";

export type GoogleWalletActivityResult = {
  synced: number;
  notified: number;
  savedWithoutNotification: number;
  failed: number;
};

const EMPTY_RESULT: GoogleWalletActivityResult = {
  synced: 0,
  notified: 0,
  savedWithoutNotification: 0,
  failed: 0,
};

/**
 * Direct (no queue) Google Wallet refresh after a confirmed loyalty operation:
 * PATCH the object without Google's generic notice, then add the activity
 * message. A failure loses only this message; the next sync restores balances.
 * See docs/WALLET_ACTIVITY_MESSAGES.md for the planned worker.
 */
export async function dispatchGoogleWalletActivity(options: {
  customerId: string;
}): Promise<GoogleWalletActivityResult> {
  if (!walletProviderConfig("GOOGLE").configured) return EMPTY_RESULT;
  const publicUrl = process.env.SWIFTWALLET_PUBLIC_URL?.trim();
  if (!publicUrl) return EMPTY_RESULT;

  const supabase = createSupabaseAdminClient();
  const { data: passes, error } = await supabase
    .from("wallet_passes")
    .select("id,customer_card_id,tenant_id")
    .eq("provider", "GOOGLE")
    .eq("status", "ACTIVE")
    .eq("customer_id", options.customerId)
    .limit(10);
  if (error || !passes?.length) return EMPTY_RESULT;

  const result = { ...EMPTY_RESULT };
  for (const pass of passes) {
    try {
      const { data: card, error: cardError } = await supabase
        .from("customer_cards")
        .select("public_token")
        .eq("id", pass.customer_card_id)
        .eq("tenant_id", pass.tenant_id)
        .eq("status", "ACTIVE")
        .maybeSingle();
      if (cardError || !card) continue;

      const loaded = await loadGoogleWalletPassSource(card.public_token, publicUrl);
      if (!loaded.ok) continue;
      const { source } = loaded;

      const synced = await syncGoogleWalletPass(source.passData, { notifyOnUpdate: false });
      result.synced += 1;

      const message = source.activityMessage;
      if (message.eventKey) {
        const delivery = await addGoogleWalletMessage(synced.objectId, {
          id: message.eventKey,
          header: message.title,
          body: message.body,
        });
        if (delivery === "NOTIFIED") result.notified += 1;
        if (delivery === "SAVED_WITHOUT_NOTIFICATION") result.savedWithoutNotification += 1;
      }

      await supabase
        .from("wallet_passes")
        .update({
          last_synced_at: new Date().toISOString(),
          update_pending_at: null,
          last_error: null,
        })
        .eq("id", pass.id);
    } catch (syncError) {
      result.failed += 1;
      console.error("[google-wallet-activity]", {
        message: syncError instanceof Error ? syncError.message.slice(0, 200) : "Unknown error",
      });
      await supabase
        .from("wallet_passes")
        .update({ last_error: "Google Wallet activity update failed." })
        .eq("id", pass.id);
    }
  }
  return result;
}
