"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { validateLoyaltyProgramForm } from "@/lib/admin/program";

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
  const rpcInput = {
    target_status: input.status,
    target_rule_type: input.ruleType,
    target_minimum_purchase_minor: input.minimumPurchaseMinor,
    target_stamps_per_purchase: input.stampsPerPurchase,
    target_amount_per_stamp_minor: input.amountPerStampMinor,
    target_carry_remainder: input.carryRemainder,
    target_reward_stamp_goal: input.rewardStampGoal,
    target_reward_name: input.rewardName,
    target_reward_description: input.rewardDescription,
    target_reward_expiration_days: input.rewardExpirationDays,
  };

  if (input.programId) {
    const { data, error } = await context.supabase.schema("app").rpc(
      "configure_loyalty_program",
      {
        target_program_id: input.programId,
        target_name: input.name,
        ...rpcInput,
      },
    );

    if (error || data !== "UPDATED") {
      redirectWithError("No se pudo actualizar el programa.");
    }
  } else {
    const { data, error } = await context.supabase.schema("app").rpc(
      "create_loyalty_program",
      {
        target_name: input.name,
        ...rpcInput,
      },
    );
    const result = Array.isArray(data) ? data[0]?.result : null;

    if (error || result !== "CREATED") {
      redirectWithError(
        result === "ALREADY_EXISTS"
          ? "El tenant ya tiene un programa; recarga la página para editarlo."
          : "No se pudo crear el programa.",
      );
    }
  }

  redirect(`/admin/program?saved=1&status=${input.status}`);
}
