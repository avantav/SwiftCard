"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { GEOFENCE_REJECTION_MESSAGE, isGeofenceRejection, readOperationCoordinates } from "@/lib/geofencing/operation-location";
import { dispatchAppleWalletUpdatesBestEffort } from "@/lib/wallet/apple-apns";

export async function redeemReward(formData: FormData) {
  const rewardId = String(formData.get("rewardId") ?? "").trim();
  const branchId = String(formData.get("branchId") ?? "").trim();
  if (!rewardId || !branchId) redirect("/app/redeem?error=Selecciona recompensa y sucursal.");
  const coordinates = readOperationCoordinates(formData);
  if (!coordinates.ok) redirect(`/app/redeem?error=${encodeURIComponent(coordinates.error)}`);
  const context = await requireInternalArea("APP");
  const { data: reward } = await context.supabase
    .from("rewards")
    .select("customer_id")
    .eq("id", rewardId)
    .maybeSingle();
  const { data, error } = await context.supabase.schema("app").rpc("redeem_reward", {
    target_reward_id: rewardId,
    target_branch_id: branchId,
    target_latitude: coordinates.data.latitude,
    target_longitude: coordinates.data.longitude
  });
  const result = Array.isArray(data) ? data[0] : null;
  if (error || !result || result.result !== "REDEEMED") redirect(`/app/redeem?error=${encodeURIComponent(isGeofenceRejection(error) ? GEOFENCE_REJECTION_MESSAGE : "La recompensa no está disponible.")}`);
  if (reward?.customer_id) {
    await dispatchAppleWalletUpdatesBestEffort({
      limit: 1,
      customerId: reward.customer_id,
    });
  }
  redirect("/app/redeem?redeemed=1");
}
