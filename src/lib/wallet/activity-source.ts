import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { WalletActivity } from "./activity-message";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type WalletActivityLookup = {
  tenantId: string;
  customerId: string;
  loyaltyCardId: string;
  lifetimePoints: boolean;
};

type CampaignRow = {
  campaign_id: string;
  created_at: string;
  marketing_campaigns: { wallet_message: string | null } | Array<{ wallet_message: string | null }> | null;
};

type RedemptionRow = {
  id: string;
  redeemed_at: string;
  rewards: { name: string } | Array<{ name: string }> | null;
};

/**
 * Derives the card's latest confirmed loyalty event from existing tables. The
 * result is recomputed from committed state, so retries produce the same text.
 * Lookup failures degrade to "no activity" and never block pass generation.
 */
export async function loadLatestWalletActivity(
  supabase: AdminClient,
  lookup: WalletActivityLookup,
): Promise<WalletActivity> {
  try {
    const [purchaseResult, redemptionResult, campaignResult] = await Promise.all([
      supabase
        .from("purchases")
        .select("id,created_at,stamps_awarded,units_awarded_tenths")
        .eq("tenant_id", lookup.tenantId)
        .eq("customer_id", lookup.customerId)
        .eq("loyalty_card_id", lookup.loyaltyCardId)
        .eq("status", "CONFIRMED")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("reward_redemptions")
        .select("id,redeemed_at,rewards!inner(name,loyalty_card_id)")
        .eq("tenant_id", lookup.tenantId)
        .eq("customer_id", lookup.customerId)
        .eq("status", "COMPLETED")
        .eq("rewards.loyalty_card_id", lookup.loyaltyCardId)
        .order("redeemed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("marketing_campaign_recipients")
        .select("campaign_id,created_at,marketing_campaigns!inner(wallet_message),customer_cards!inner(loyalty_card_id)")
        .eq("tenant_id", lookup.tenantId)
        .eq("customer_id", lookup.customerId)
        .eq("customer_cards.loyalty_card_id", lookup.loyaltyCardId)
        .in("channel", ["APPLE", "GOOGLE"])
        .in("status", ["PENDING", "SENT"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (purchaseResult.error || redemptionResult.error) return { kind: "NONE" };

    const purchase = purchaseResult.data;
    const redemption = redemptionResult.data as RedemptionRow | null;
    const purchaseTime = purchase ? Date.parse(purchase.created_at) : Number.NEGATIVE_INFINITY;
    const redemptionTime = redemption ? Date.parse(redemption.redeemed_at) : Number.NEGATIVE_INFINITY;

    // A campaign wins only while it is newer than any purchase or redemption.
    const campaign = campaignResult.error ? null : (campaignResult.data as CampaignRow | null);
    const campaignMessage = campaign
      ? (Array.isArray(campaign.marketing_campaigns) ? campaign.marketing_campaigns[0] : campaign.marketing_campaigns)?.wallet_message?.trim()
      : null;
    if (campaign && campaignMessage && Date.parse(campaign.created_at) > Math.max(purchaseTime, redemptionTime)) {
      return { kind: "CAMPAIGN", id: campaign.campaign_id, occurredAt: campaign.created_at, message: campaignMessage };
    }

    if (redemption && redemptionTime >= purchaseTime) {
      const reward = Array.isArray(redemption.rewards) ? redemption.rewards[0] : redemption.rewards;
      return {
        kind: "REDEMPTION",
        id: redemption.id,
        occurredAt: redemption.redeemed_at,
        rewardName: reward?.name ?? "",
      };
    }
    if (!purchase) return { kind: "NONE" };

    const { data: unlocked, error: unlockedError } = await supabase
      .from("rewards")
      .select("name")
      .eq("tenant_id", lookup.tenantId)
      .eq("customer_id", lookup.customerId)
      .eq("source_purchase_id", purchase.id)
      .order("created_at");
    const unitsAwarded = lookup.lifetimePoints
      ? Number(purchase.units_awarded_tenths ?? 0) / 10
      : Number(purchase.stamps_awarded ?? 0);

    return {
      kind: "PURCHASE",
      id: purchase.id,
      occurredAt: purchase.created_at,
      unitsAwarded: Number.isFinite(unitsAwarded) ? unitsAwarded : 0,
      unlockedRewardNames: unlockedError ? [] : (unlocked ?? []).map((reward) => reward.name),
    };
  } catch {
    return { kind: "NONE" };
  }
}
