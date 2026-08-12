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

  if (input.programId) {
    const { data: currentProgram, error: currentProgramError } =
      await context.supabase
        .from("loyalty_programs")
        .select("program_type")
        .eq("id", input.programId)
        .eq("tenant_id", context.tenantId)
        .maybeSingle();

    if (currentProgramError || !currentProgram?.program_type) {
      redirectWithError("No se pudo verificar el programa actual.");
    }

    if (
      currentProgram.program_type !== input.programType &&
      formData.get("confirmProgramTypeChange") !== "1"
    ) {
      redirectWithError("Confirma el cambio de tipo de programa.");
    }
  }

  const { data, error } = await context.supabase.schema("app").rpc(
    "save_loyalty_program_configuration",
    {
      target_program_id: input.programId,
      target_name: input.name,
      target_status: input.status,
      target_program_type: input.programType,
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
      target_unit_name_singular: input.unitNameSingular,
      target_unit_name_plural: input.unitNamePlural,
      target_welcome_reward_enabled: input.welcomeRewardEnabled,
      target_welcome_reward_name: input.welcomeRewardName,
      target_welcome_reward_description: input.welcomeRewardDescription,
      target_welcome_reward_expiration_days: input.welcomeRewardExpirationDays,
      target_grant_welcome_reward_to_imports: input.grantWelcomeRewardToImports,
      target_import_stamp_to_point_multiplier: input.importStampToPointMultiplier,
      target_allow_purchase_cancellations: input.allowPurchaseCancellations,
      target_allow_reward_cancellations: input.allowRewardCancellations,
      target_allow_redemption_reversals: input.allowRedemptionReversals,
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
