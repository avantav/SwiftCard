"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { dispatchAppleWalletUpdatesBestEffort } from "@/lib/wallet/apple-apns";

function back(params: Record<string, string>): never {
  redirect(`/app/purchase?${new URLSearchParams(params).toString()}`);
}

function required(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function previewPurchase(formData: FormData) {
  const customerCardId = required(formData, "customerCardId");
  const loyaltyCardId = required(formData, "loyaltyCardId");
  const branchId = required(formData, "branchId");
  const amountMinor = Number(required(formData, "amountMinor"));
  if (!customerCardId || !branchId || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    back({ loyaltyCardId, error: "Cliente, sucursal y monto válido son obligatorios." });
  }
  const context = await requireInternalArea("APP");
  const { data, error } = await context.supabase.schema("app").rpc("preview_card_purchase", {
    target_customer_card_id: customerCardId,
    target_branch_id: branchId,
    target_amount_minor: amountMinor
  });
  const result = Array.isArray(data) ? data[0] : null;
  if (error || !result || result.result !== "PREVIEW") {
    back({ customerCardId, loyaltyCardId, error: result?.result === "PROGRAM_PAUSED" ? "El programa está pausado." : "La tarjeta no está disponible en esta sucursal." });
  }
  back({ customerCardId, loyaltyCardId, branchId, amountMinor: String(amountMinor), previewStamps: String(result.stamps_awarded), previewRemainder: String(result.remainder_after_minor), previewBalance: String(result.projected_balance) });
}

export async function confirmPurchase(formData: FormData) {
  const customerCardId = required(formData, "customerCardId");
  const loyaltyCardId = required(formData, "loyaltyCardId");
  const branchId = required(formData, "branchId");
  const ticketNumber = required(formData, "ticketNumber");
  const amountMinor = Number(required(formData, "amountMinor"));
  if (!customerCardId || !branchId || !ticketNumber || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    back({ loyaltyCardId, error: "Cliente, sucursal, ticket y monto válido son obligatorios." });
  }
  const context = await requireInternalArea("APP");
  const { data, error } = await context.supabase.schema("app").rpc("confirm_card_purchase", {
    target_customer_card_id: customerCardId,
    target_branch_id: branchId,
    target_ticket_number: ticketNumber,
    target_amount_minor: amountMinor,
    target_latitude: null,
    target_longitude: null
  });
  const result = Array.isArray(data) ? data[0] : null;
  if (error || !result || result.result !== "CONFIRMED") {
    back({ customerCardId, loyaltyCardId, branchId, amountMinor: String(amountMinor), error: result?.result === "DUPLICATE_TICKET" ? "Ese ticket ya está registrado en la sucursal." : "No se pudo confirmar la compra." });
  }
  await dispatchAppleWalletUpdatesBestEffort({ limit: 1 });
  back({ customerCardId, loyaltyCardId, confirmed: "1", rewards: String(result.rewards_generated), stamps: String(result.stamps_awarded) });
}
