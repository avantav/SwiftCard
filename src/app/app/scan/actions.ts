"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { parseCardQrPayload } from "@/lib/scanner/qr";

export async function resolveScannedCard(formData: FormData) {
  const parsed = parseCardQrPayload(String(formData.get("payload") ?? ""));
  if (!parsed.ok) redirect(`/app/scan?error=${encodeURIComponent(parsed.error)}`);
  const context = await requireInternalArea("APP");
  const { data, error } = await context.supabase
    .schema("app")
    .rpc("resolve_staff_card_scan", { target_card_token: parsed.cardToken });
  const result = Array.isArray(data) ? data[0] : null;
  if (error || !result || result.result !== "FOUND") {
    redirect(`/app/scan?error=${encodeURIComponent("Esta tarjeta no pertenece a este negocio.")}`);
  }
  if (typeof result.loyalty_card_id !== "string") {
    redirect(`/app/scan?error=${encodeURIComponent("Esta tarjeta no tiene un programa configurado.")}`);
  }
  redirect(`/app/purchase?${new URLSearchParams({ customerCardId: result.customer_card_id, loyaltyCardId: result.loyalty_card_id }).toString()}`);
}
