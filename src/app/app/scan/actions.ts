"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { validateEmployeeCustomerRegistration } from "@/lib/customers/employee-registration";
import { parseCardQrPayload } from "@/lib/scanner/qr";
import { dispatchAppleWalletUpdatesBestEffort } from "@/lib/wallet/apple-apns";

function back(params: Record<string, string>): never {
  redirect(`/app/scan?${new URLSearchParams(params).toString()}`);
}

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
  redirect(`/app/scan?${new URLSearchParams({ customerCardId: result.customer_card_id, loyaltyCardId: result.loyalty_card_id }).toString()}`);
}

export async function redeemCustomerReward(formData: FormData) {
  const rewardId = String(formData.get("rewardId") ?? "").trim();
  const branchId = String(formData.get("branchId") ?? "").trim();
  const customerCardId = String(formData.get("customerCardId") ?? "").trim();
  const loyaltyCardId = String(formData.get("loyaltyCardId") ?? "").trim();
  const returnParams = { customerCardId, loyaltyCardId };
  if (!rewardId || !branchId || !customerCardId || !loyaltyCardId) {
    back({ ...returnParams, error: "Selecciona un premio y una sucursal." });
  }

  const context = await requireInternalArea("APP");
  const { data: summaryData } = await context.supabase.schema("app").rpc("get_staff_customer_card_summary", {
    target_customer_card_id: customerCardId,
  });
  const summary = Array.isArray(summaryData) ? summaryData[0] as {
    available_rewards?: Array<{ id?: string }>;
    customer_id?: string;
    loyalty_card_id?: string;
  } | undefined : undefined;
  if (
    !summary
    || summary.loyalty_card_id !== loyaltyCardId
    || !Array.isArray(summary.available_rewards)
    || !summary.available_rewards.some((reward) => reward.id === rewardId)
  ) {
    back({ ...returnParams, error: "El premio ya no está disponible." });
  }
  const { data, error } = await context.supabase.schema("app").rpc("redeem_reward", {
    target_reward_id: rewardId,
    target_branch_id: branchId,
    target_latitude: null,
    target_longitude: null,
  });
  const result = Array.isArray(data) ? data[0] : null;
  if (error || !result || result.result !== "REDEEMED") {
    back({ ...returnParams, error: "El premio ya no está disponible." });
  }
  if (summary.customer_id) {
    await dispatchAppleWalletUpdatesBestEffort({ limit: 1, customerId: summary.customer_id });
  }
  back({ ...returnParams, redeemed: "1" });
}

export async function updateCustomer(formData: FormData) {
  const customerId = formData.get("customerId");
  const returnQuery = String(formData.get("returnQuery") ?? "").trim().slice(0, 120);
  if (typeof customerId !== "string" || !customerId) {
    back({ q: returnQuery, error: "Cliente inválido." });
  }

  const context = await requireInternalArea("APP");
  if (context.access.role !== "MANAGER") {
    back({ q: returnQuery, error: "No tienes permiso para editar clientes." });
  }

  const validation = validateEmployeeCustomerRegistration(formData);
  if (!validation.ok) {
    back({ q: returnQuery, error: validation.errors.join(" ") });
  }

  const { data, error } = await context.supabase.schema("app").rpc("update_customer_profile", {
    target_customer_id: customerId,
    target_full_name: validation.data.fullName,
    target_normalized_phone: validation.data.phone,
    target_email: validation.data.email ?? "",
    target_birth_date: validation.data.birthDate,
    target_status: formData.get("status") === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  });

  if (error || data === "DUPLICATE") {
    back({ q: returnQuery, error: "Ese teléfono ya está registrado." });
  }
  if (data !== "UPDATED") {
    back({ q: returnQuery, error: "No tienes acceso a ese cliente." });
  }

  await dispatchAppleWalletUpdatesBestEffort({ limit: 1, customerId });
  back({ q: returnQuery, updated: "1" });
}
