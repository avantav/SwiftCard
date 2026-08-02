"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";

export async function redeemReward(formData: FormData) {
  const rewardId = String(formData.get("rewardId") ?? "").trim();
  const branchId = String(formData.get("branchId") ?? "").trim();
  if (!rewardId || !branchId) redirect("/app/redeem?error=Selecciona recompensa y sucursal.");
  const context = await requireInternalArea("APP");
  const { data, error } = await context.supabase.schema("app").rpc("redeem_reward", {
    target_reward_id: rewardId,
    target_branch_id: branchId,
    target_latitude: null,
    target_longitude: null
  });
  const result = Array.isArray(data) ? data[0] : null;
  if (error || !result || result.result !== "REDEEMED") redirect("/app/redeem?error=La recompensa no está disponible.");
  redirect("/app/redeem?redeemed=1");
}
