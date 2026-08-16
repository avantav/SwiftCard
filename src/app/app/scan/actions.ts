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
  redirect(`/app/purchase?${new URLSearchParams({ customerCardId: result.customer_card_id, loyaltyCardId: result.loyalty_card_id }).toString()}`);
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
