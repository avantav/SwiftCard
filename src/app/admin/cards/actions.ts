"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { validateLoyaltyProgramForm } from "@/lib/admin/program";
import { validateAppleWalletDesignForm } from "@/lib/wallet/design";
import { dispatchAppleWalletUpdatesBestEffort } from "@/lib/wallet/apple-apns";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cardPath(cardId: string, step: number, values: Record<string, string> = {}) {
  const query = new URLSearchParams({ step: String(step), ...values });
  return `/admin/cards/${encodeURIComponent(cardId)}/edit?${query.toString()}`;
}

function redirectCardError(cardId: string, step: number, message: string): never {
  redirect(cardPath(cardId, step, { error: message }));
}

function redirectAfterSave(cardId: string, nextStep: number, formData: FormData): never {
  if (formData.get("intent") === "exit") redirect("/admin/cards");
  redirect(cardPath(cardId, nextStep, { saved: "1" }));
}

async function requireTenantAdmin() {
  const context = await requireInternalArea("ADMIN");
  if (context.access.role !== "ADMIN" || !context.tenantId) redirect("/admin");
  return context;
}

export async function createCardDraft(formData: FormData) {
  const context = await requireTenantAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 80) {
    redirect(`/admin/cards?error=${encodeURIComponent("Escribe un nombre de hasta 80 caracteres.")}`);
  }
  const { data, error } = await context.supabase.schema("app").rpc(
    "create_loyalty_card_draft",
    { target_name: name },
  );
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !["CREATED", "EXISTS"].includes(row?.result) || !row.loyalty_card_id) {
    const message = row?.result === "LIMIT_REACHED"
      ? "Ya tienes tres tarjetas. Archiva una antes de crear otra."
      : "No se pudo crear el borrador.";
    redirect(`/admin/cards?error=${encodeURIComponent(message)}`);
  }
  redirect(cardPath(row.loyalty_card_id, 1, { [row.result === "EXISTS" ? "resumed" : "created"]: "1" }));
}

export async function archiveCard(cardId: string) {
  const context = await requireTenantAdmin();
  if (!UUID.test(cardId)) redirect("/admin/cards");
  const { data, error } = await context.supabase.schema("app").rpc(
    "archive_loyalty_card",
    { target_card_id: cardId },
  );
  if (error || !["DISCARDED", "DEACTIVATED"].includes(data)) {
    redirect(`/admin/cards?error=${encodeURIComponent("No se pudo desactivar la tarjeta.")}`);
  }
  await dispatchAppleWalletUpdatesBestEffort({ limit: 25, tenantId: context.tenantId! });
  redirect(`/admin/cards?${data === "DISCARDED" ? "discarded" : "deactivated"}=1`);
}

export async function restoreCard(cardId: string) {
  const context = await requireTenantAdmin();
  if (!UUID.test(cardId)) redirect("/admin/cards");
  const { data, error } = await context.supabase.schema("app").rpc(
    "restore_loyalty_card",
    { target_card_id: cardId },
  );
  if (error || data !== "RESTORED") {
    const message = data === "LIMIT_REACHED"
      ? "Ya tienes tres tarjetas activas o en borrador. Desactiva una antes de reactivar esta."
      : data === "DUPLICATE"
        ? "Ya existe un borrador activo con el mismo nombre."
        : "No se pudo reactivar la tarjeta.";
    redirect(`/admin/cards?error=${encodeURIComponent(message)}`);
  }
  await dispatchAppleWalletUpdatesBestEffort({ limit: 25, tenantId: context.tenantId! });
  redirect("/admin/cards?restored=1");
}

export async function deleteCard(cardId: string) {
  const context = await requireTenantAdmin();
  if (!UUID.test(cardId)) redirect("/admin/cards");
  const { data, error } = await context.supabase.schema("app").rpc(
    "delete_archived_loyalty_card",
    { target_card_id: cardId },
  );
  if (error || data !== "DELETED") {
    const message = data === "HAS_HISTORY"
      ? "No se puede eliminar porque tiene tarjetas emitidas o historial. Puedes mantenerla desactivada."
      : "No se pudo eliminar la tarjeta.";
    redirect(`/admin/cards?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/cards?deleted=1");
}

export async function saveCardProgram(cardId: string, formData: FormData) {
  const context = await requireTenantAdmin();
  if (!UUID.test(cardId)) redirect("/admin/cards");
  const [{ data: tenant, error: tenantError }, { data: card, error: cardError }] = await Promise.all([
    context.supabase.from("tenants").select("currency_code").eq("id", context.tenantId).maybeSingle(),
    context.supabase.from("loyalty_cards").select("program_id").eq("id", cardId).eq("tenant_id", context.tenantId).maybeSingle(),
  ]);
  if (tenantError || !tenant?.currency_code || cardError || !card?.program_id) {
    redirectCardError(cardId, 1, "No se pudo determinar la moneda del negocio.");
  }

  formData.set("status", "PAUSED");
  const programType = String(formData.get("programType") ?? "");
  const { data: currentProgram, error: programError } = await context.supabase
    .from("loyalty_programs")
    .select("program_type")
    .eq("id", card.program_id)
    .eq("tenant_id", context.tenantId)
    .maybeSingle();
  if (programError || !currentProgram?.program_type) {
    redirectCardError(cardId, 1, "No se pudo comprobar el programa actual.");
  }
  if (
    currentProgram.program_type !== programType
    && formData.get("confirmProgramTypeChange") !== "on"
  ) {
    redirectCardError(cardId, 1, "Confirma el cambio de tipo de programa antes de guardar.");
  }
  const singular = String(formData.get("unitNameSingular") ?? "").trim().toLowerCase();
  const plural = String(formData.get("unitNamePlural") ?? "").trim().toLowerCase();
  if (programType === "LIFETIME_POINTS" && singular === "sello" && plural === "sellos") {
    formData.set("unitNameSingular", "punto");
    formData.set("unitNamePlural", "puntos");
  } else if (programType !== "LIFETIME_POINTS" && singular === "punto" && plural === "puntos") {
    formData.set("unitNameSingular", "sello");
    formData.set("unitNamePlural", "sellos");
  }
  const validation = validateLoyaltyProgramForm(formData, tenant.currency_code);
  if (!validation.ok) {
    redirectCardError(cardId, 1, validation.errors[0] ?? "Revisa el programa.");
  }
  const input = validation.data;
  const { data, error } = await context.supabase.schema("app").rpc(
    "save_loyalty_card_program",
    {
      target_card_id: cardId,
      target_name: input.name,
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
    },
  );
  if (error || data !== "SAVED") {
    redirectCardError(cardId, 1, "No se pudo guardar el programa de esta tarjeta.");
  }
  await dispatchAppleWalletUpdatesBestEffort({
    limit: 25,
    tenantId: context.tenantId!,
  });
  redirectAfterSave(cardId, 2, formData);
}

export async function saveCardDesign(cardId: string, formData: FormData) {
  const context = await requireTenantAdmin();
  if (!UUID.test(cardId)) redirect("/admin/cards");
  const validation = validateAppleWalletDesignForm(formData);
  if (!validation.ok) {
    redirectCardError(cardId, 2, validation.errors[0] ?? "Revisa el diseño.");
  }
  const input = validation.data;
  const { data, error } = await context.supabase.schema("app").rpc(
    "save_loyalty_card_design",
    {
      target_card_id: cardId,
      target_wallet_enabled: input.appleEnabled,
      target_logo_text: input.logoText,
      target_description: input.description,
      target_background_color: input.backgroundColor,
      target_foreground_color: input.foregroundColor,
      target_label_color: input.labelColor,
      target_logo_image_url: input.logoImageUrl ?? "",
      target_strip_image_url: input.stripImageUrl ?? "",
    },
  );
  if (error || data !== "SAVED") {
    redirectCardError(cardId, 2, "No se pudo guardar el diseño de la tarjeta.");
  }
  await dispatchAppleWalletUpdatesBestEffort({ limit: 25, tenantId: context.tenantId! });
  redirectAfterSave(cardId, 3, formData);
}

export async function saveCardLocations(cardId: string, formData: FormData) {
  const context = await requireTenantAdmin();
  if (!UUID.test(cardId)) redirect("/admin/cards");
  const branchIds = formData.getAll("branchId").filter(
    (value): value is string => typeof value === "string" && UUID.test(value),
  );
  if (!branchIds.length) {
    redirectCardError(cardId, 3, "Selecciona al menos una sucursal.");
  }
  const { data, error } = await context.supabase.schema("app").rpc(
    "save_loyalty_card_locations",
    { target_card_id: cardId, target_branch_ids: branchIds },
  );
  if (error || data !== "SAVED") {
    redirectCardError(cardId, 3, "No se pudieron guardar las sucursales.");
  }
  await dispatchAppleWalletUpdatesBestEffort({
    limit: 25,
    tenantId: context.tenantId!,
  });
  redirectAfterSave(cardId, 4, formData);
}

export async function publishCard(cardId: string) {
  const context = await requireTenantAdmin();
  if (!UUID.test(cardId)) redirect("/admin/cards");
  const { data, error } = await context.supabase.schema("app").rpc(
    "publish_loyalty_card",
    { target_card_id: cardId },
  );
  if (error || data !== "PUBLISHED") {
    redirectCardError(
      cardId,
      4,
      data === "INCOMPLETE" ? "Completa las etapas anteriores antes de publicar." : "No se pudo publicar la tarjeta.",
    );
  }
  await dispatchAppleWalletUpdatesBestEffort({ limit: 25, tenantId: context.tenantId! });
  redirect("/admin/cards?published=1");
}
