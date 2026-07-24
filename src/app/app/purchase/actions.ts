"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";

function back(params: Record<string, string>): never {
  redirect(`/app/purchase?${new URLSearchParams(params).toString()}`);
}

function required(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function previewPurchase(formData: FormData) {
  const customerId = required(formData, "customerId");
  const branchId = required(formData, "branchId");
  const amountMinor = Number(required(formData, "amountMinor"));
  if (!customerId || !branchId || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    back({ error: "Cliente, sucursal y monto válido son obligatorios." });
  }
  const context = await requireInternalArea("APP");
  const { data, error } = await context.supabase.rpc("preview_purchase", {
    target_customer_id: customerId,
    target_branch_id: branchId,
    target_amount_minor: amountMinor
  });
  const result = Array.isArray(data) ? data[0] : null;
  if (error || !result || result.result !== "PREVIEW") {
    back({ customerId, error: result?.result === "PROGRAM_PAUSED" ? "El programa está pausado." : "No se pudo previsualizar la compra." });
  }
  back({ customerId, branchId, amountMinor: String(amountMinor), previewStamps: String(result.stamps_awarded), previewRemainder: String(result.remainder_after_minor), previewBalance: String(result.projected_balance) });
}

export async function confirmPurchase(formData: FormData) {
  const customerId = required(formData, "customerId");
  const branchId = required(formData, "branchId");
  const ticketNumber = required(formData, "ticketNumber");
  const amountMinor = Number(required(formData, "amountMinor"));
  if (!customerId || !branchId || !ticketNumber || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    back({ error: "Cliente, sucursal, ticket y monto válido son obligatorios." });
  }
  const context = await requireInternalArea("APP");
  const { data, error } = await context.supabase.rpc("confirm_purchase", {
    target_customer_id: customerId,
    target_branch_id: branchId,
    target_ticket_number: ticketNumber,
    target_amount_minor: amountMinor,
    target_latitude: null,
    target_longitude: null
  });
  const result = Array.isArray(data) ? data[0] : null;
  if (error || !result || result.result !== "CONFIRMED") {
    back({ customerId, branchId, amountMinor: String(amountMinor), error: result?.result === "DUPLICATE_TICKET" ? "Ese ticket ya está registrado en la sucursal." : "No se pudo confirmar la compra." });
  }
  back({ customerId, confirmed: "1", rewards: String(result.rewards_generated), stamps: String(result.stamps_awarded) });
}
