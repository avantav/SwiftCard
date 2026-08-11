"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { validateLoyaltyProgramForm } from "@/lib/admin/program";
import { dispatchAppleWalletUpdatesBestEffort } from "@/lib/wallet/apple-apns";

function redirectWithError(error: string): never {
  redirect(`/admin/program?error=${encodeURIComponent(error)}`);
}

export async function saveLoyaltyProgram(formData: FormData) {
  const context = await requireInternalArea("ADMIN");

  if (context.access.role !== "ADMIN" || !context.tenantId) {
    redirectWithError("Solo el Administrador puede configurar el programa.");
  }

  const { data: tenant, error: tenantError } = await context.supabase
    .from("tenants")
    .select("currency_code")
    .eq("id", context.tenantId)
    .maybeSingle();

  if (tenantError || !tenant?.currency_code) {
    redirectWithError("No se pudo determinar la moneda del tenant.");
  }

  const validation = validateLoyaltyProgramForm(
    formData,
    tenant.currency_code,
  );

  if (!validation.ok) {
    redirectWithError(
      validation.errors[0] ?? "La configuración del programa no es válida.",
    );
  }

  const input = validation.data;
  const { data, error } = await context.supabase.schema("app").rpc(
    "save_loyalty_program_with_tiers",
    {
      target_program_id: input.programId,
      target_name: input.name,
      target_status: input.status,
      target_rule_type: input.ruleType,
      target_minimum_purchase_minor: input.minimumPurchaseMinor,
      target_stamps_per_purchase: input.stampsPerPurchase,
      target_amount_per_stamp_minor: input.amountPerStampMinor,
      target_carry_remainder: input.carryRemainder,
      target_terms_and_conditions: input.termsAndConditions,
      target_reward_tiers: input.rewardTiers.map((tier) => ({
        stamps_required: tier.stampsRequired,
        name: tier.name,
        description: tier.description,
        expiration_days: tier.expirationDays,
      })),
    },
  );
  const result = Array.isArray(data) ? data[0]?.result : null;
  const expectedResult = input.programId ? "UPDATED" : "CREATED";

  if (error || result !== expectedResult) {
    redirectWithError(
      result === "ALREADY_EXISTS"
        ? "El tenant ya tiene un programa; recarga la página para editarlo."
        : "No se pudo guardar el programa y sus niveles.",
    );
  }

  await dispatchAppleWalletUpdatesBestEffort({
    limit: 25,
    tenantId: context.tenantId,
  });
  redirect(`/admin/program?saved=1&status=${input.status}`);
}
