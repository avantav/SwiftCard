import "server-only";

import type { ActivityItem, CorrectionProgram, ProgramType } from "@/lib/admin/customer-activity";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const LIMIT = 40;

export type CustomerActivity = {
  customer: { id: string; fullName: string; phone: string; email: string | null; birthDate: string | null; status: "ACTIVE" | "INACTIVE"; createdAt: string };
  cardName: string | null;
  program: CorrectionProgram | null;
  balance: { stamps: number; lifetimePoints: number };
  branches: { id: string; name: string }[];
  items: ActivityItem[];
};

/**
 * Reads one customer's card, balance and recent movements with the session
 * client (RLS) for the tenant in the session context (DEC-0074). Returns
 * null when the customer is not visible to this admin.
 */
export async function loadCustomerActivity(supabase: ServerClient, tenantId: string, customerId: string): Promise<CustomerActivity | null> {
  const { data: customer } = await supabase.from("customers")
    .select("id,full_name,normalized_phone,email,birth_date,status,created_at")
    .eq("id", customerId).eq("tenant_id", tenantId).maybeSingle();
  if (!customer) return null;

  const [cardResult, balanceResult, purchases, redemptions, rewards, adjustments, branchRows] = await Promise.all([
    supabase.from("customer_cards").select("loyalty_card_id,status").eq("customer_id", customerId).eq("tenant_id", tenantId).eq("status", "ACTIVE").limit(1).maybeSingle(),
    supabase.from("customer_loyalty_balances").select("stamp_balance,lifetime_points_tenths").eq("customer_id", customerId).eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("purchases").select("id,occurred_at,amount_minor,ticket_number,stamps_awarded,status,branch_id,cancellation_reason").eq("customer_id", customerId).eq("tenant_id", tenantId).order("occurred_at", { ascending: false }).limit(LIMIT),
    supabase.from("reward_redemptions").select("id,redeemed_at,status,reward_id,branch_id,reversal_reason").eq("customer_id", customerId).eq("tenant_id", tenantId).order("redeemed_at", { ascending: false }).limit(LIMIT),
    supabase.from("rewards").select("id,name,status,created_at,expires_at,cancellation_reason").eq("customer_id", customerId).eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("stamp_adjustments").select("id,created_at,stamps_delta,reason,branch_id").eq("customer_id", customerId).eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("branches").select("id,name").eq("tenant_id", tenantId),
  ]);

  const branchName = new Map((branchRows.data ?? []).map((branch) => [branch.id as string, branch.name as string]));
  const rewardName = new Map((rewards.data ?? []).map((reward) => [reward.id as string, reward.name as string]));

  let cardName: string | null = null;
  let program: CorrectionProgram | null = null;
  let cardBranches: { id: string; name: string }[] = [];
  if (cardResult.data?.loyalty_card_id) {
    const cardId = cardResult.data.loyalty_card_id as string;
    const [{ data: card }, { data: assigned }] = await Promise.all([
      supabase.from("loyalty_cards").select("name,program_id").eq("id", cardId).eq("tenant_id", tenantId).maybeSingle(),
      supabase.from("loyalty_card_branches").select("branch_id").eq("loyalty_card_id", cardId),
    ]);
    cardName = card?.name ?? null;
    cardBranches = (assigned ?? []).flatMap((row) => branchName.has(row.branch_id) ? [{ id: row.branch_id as string, name: branchName.get(row.branch_id)! }] : []);
    if (card?.program_id) {
      const { data: row } = await supabase.from("loyalty_programs")
        .select("program_type,unit_name_singular,unit_name_plural,allow_purchase_cancellations,allow_reward_cancellations,allow_redemption_reversals")
        .eq("id", card.program_id).eq("tenant_id", tenantId).maybeSingle();
      if (row) {
        program = {
          programType: row.program_type as ProgramType,
          unitSingular: row.unit_name_singular,
          unitPlural: row.unit_name_plural,
          allowPurchaseCancellations: row.allow_purchase_cancellations,
          allowRewardCancellations: row.allow_reward_cancellations,
          allowRedemptionReversals: row.allow_redemption_reversals,
        };
      }
    }
  }

  const items: ActivityItem[] = [
    ...(purchases.data ?? []).map((row): ActivityItem => ({ kind: "purchase", id: row.id, at: row.occurred_at, branch: branchName.get(row.branch_id) ?? "Sucursal", amountMinor: Number(row.amount_minor), ticket: row.ticket_number, units: Number(row.stamps_awarded), status: row.status, note: row.cancellation_reason })),
    ...(redemptions.data ?? []).map((row): ActivityItem => ({ kind: "redemption", id: row.id, at: row.redeemed_at, branch: branchName.get(row.branch_id) ?? "Sucursal", reward: rewardName.get(row.reward_id) ?? "Premio", status: row.status, note: row.reversal_reason })),
    ...(rewards.data ?? []).map((row): ActivityItem => ({ kind: "reward", id: row.id, at: row.created_at, reward: row.name, status: row.status, expiresAt: row.expires_at, note: row.cancellation_reason })),
    ...(adjustments.data ?? []).map((row): ActivityItem => ({ kind: "adjustment", id: row.id, at: row.created_at, branch: branchName.get(row.branch_id) ?? "Sucursal", delta: Number(row.stamps_delta), note: row.reason })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return {
    customer: {
      id: customer.id,
      fullName: customer.full_name,
      phone: customer.normalized_phone,
      email: customer.email,
      birthDate: customer.birth_date,
      status: customer.status,
      createdAt: customer.created_at,
    },
    cardName,
    program,
    balance: { stamps: Number(balanceResult.data?.stamp_balance ?? 0), lifetimePoints: Number(balanceResult.data?.lifetime_points_tenths ?? 0) / 10 },
    branches: cardBranches,
    items,
  };
}
