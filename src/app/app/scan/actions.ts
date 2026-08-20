"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { validateEmployeeCustomerRegistration } from "@/lib/customers/employee-registration";
import { parsePurchaseAmount } from "@/lib/loyalty/purchase-amount";
import { parseCardQrPayload } from "@/lib/scanner/qr";
import { dispatchAppleWalletUpdatesBestEffort } from "@/lib/wallet/apple-apns";

function back(params: Record<string, string>): never {
  redirect(`/app/scan?${new URLSearchParams(params).toString()}`);
}

function required(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
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
  const confirmationParams = { ...returnParams, flow: "reward", step: "confirm", rewardId, branchId };
  if (!rewardId || !branchId || !customerCardId || !loyaltyCardId) {
    back({ ...returnParams, flow: "reward", error: "Selecciona un premio y una sucursal." });
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
    back({ ...confirmationParams, error: "El premio ya no está disponible." });
  }
  const { data, error } = await context.supabase.schema("app").rpc("redeem_reward", {
    target_reward_id: rewardId,
    target_branch_id: branchId,
    target_latitude: null,
    target_longitude: null,
  });
  const result = Array.isArray(data) ? data[0] : null;
  if (error || !result || result.result !== "REDEEMED") {
    back({ ...confirmationParams, error: "El premio ya no está disponible." });
  }
  if (summary.customer_id) {
    await dispatchAppleWalletUpdatesBestEffort({ limit: 1, customerId: summary.customer_id });
  }
  back({ ...returnParams, redeemed: "1" });
}

export async function previewCustomerPurchase(formData: FormData) {
  const customerCardId = required(formData, "customerCardId");
  const loyaltyCardId = required(formData, "loyaltyCardId");
  const branchId = required(formData, "branchId");
  const amount = required(formData, "amount");
  const returnParams = { customerCardId, loyaltyCardId, flow: "purchase" };
  const context = await requireInternalArea("APP");
  const { data: tenant } = await context.supabase
    .from("tenants")
    .select("currency_code")
    .eq("id", context.tenantId)
    .maybeSingle();
  const currencyCode = tenant?.currency_code ?? "MXN";
  const amountMinor = parsePurchaseAmount(amount, currencyCode);
  if (!customerCardId || !loyaltyCardId || !branchId || amountMinor === null) {
    back({ ...returnParams, branchId, amount, error: `Selecciona una sucursal e ingresa un monto válido en ${currencyCode}.` });
  }

  const { data, error } = await context.supabase.schema("app").rpc("preview_card_purchase", {
    target_customer_card_id: customerCardId,
    target_branch_id: branchId,
    target_amount_minor: amountMinor,
  });
  const result = Array.isArray(data) ? data[0] : null;
  if (error || !result || result.result !== "PREVIEW") {
    back({ ...returnParams, branchId, amount, error: result?.result === "PROGRAM_PAUSED" ? "El programa está pausado." : "La tarjeta no está disponible en esta sucursal." });
  }
  back({
    ...returnParams,
    step: "confirm",
    branchId,
    amount,
  });
}

export async function confirmCustomerPurchase(formData: FormData) {
  const customerCardId = required(formData, "customerCardId");
  const loyaltyCardId = required(formData, "loyaltyCardId");
  const branchId = required(formData, "branchId");
  const amount = required(formData, "amount");
  const ticketNumber = required(formData, "ticketNumber");
  const returnParams = { customerCardId, loyaltyCardId };
  const confirmationParams = { ...returnParams, flow: "purchase", step: "confirm", branchId, amount };
  const context = await requireInternalArea("APP");
  const { data: tenant } = await context.supabase
    .from("tenants")
    .select("currency_code")
    .eq("id", context.tenantId)
    .maybeSingle();
  const currencyCode = tenant?.currency_code ?? "MXN";
  const amountMinor = parsePurchaseAmount(amount, currencyCode);
  if (!customerCardId || !loyaltyCardId || !branchId || !ticketNumber || amountMinor === null) {
    back({ ...confirmationParams, error: "Revisa el monto, la sucursal y el número de ticket." });
  }

  const { data, error } = await context.supabase.schema("app").rpc("confirm_card_purchase", {
    target_customer_card_id: customerCardId,
    target_branch_id: branchId,
    target_ticket_number: ticketNumber,
    target_amount_minor: amountMinor,
    target_latitude: null,
    target_longitude: null,
  });
  const result = Array.isArray(data) ? data[0] : null;
  if (error || !result || result.result !== "CONFIRMED") {
    back({ ...confirmationParams, error: result?.result === "DUPLICATE_TICKET" ? "Ese ticket ya está registrado en la sucursal." : "No se pudo confirmar la compra." });
  }
  await dispatchAppleWalletUpdatesBestEffort({ limit: 1 });
  back({ ...returnParams, purchaseConfirmed: "1", rewards: String(result.rewards_generated), stamps: String(result.stamps_awarded) });
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
