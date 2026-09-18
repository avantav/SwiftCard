"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveSuperadminContext } from "@/lib/auth/server";
import { validateBillingPromotionForm } from "@/lib/billing/promotions";

const promotionsPath = "/superadmin/billing/promotions";

function fail(message: string): never {
  redirect(`${promotionsPath}?error=${encodeURIComponent(message)}`);
}

export async function createBillingPromotion(formData: FormData) {
  const validation = validateBillingPromotionForm(formData);
  if (!validation.ok) fail(validation.errors[0] ?? "Datos inválidos.");

  const context = await getActiveSuperadminContext();
  if (!context) fail("No tienes permisos para administrar promociones.");
  const input = validation.data;
  const { data, error } = await context.supabase.schema("app").rpc(
    "create_billing_promotion",
    {
      target_code: input.code,
      target_name: input.name,
      target_description: input.description,
      target_discount_type: input.discountType,
      target_percent_off_basis_points: input.percentOffBasisPoints,
      target_amount_off_minor: input.amountOffMinor,
      target_currency_code: input.currencyCode,
      target_duration: input.duration,
      target_duration_months: input.durationMonths,
      target_starts_at: input.startsAt,
      target_ends_at: input.endsAt,
      target_max_redemptions: input.maxRedemptions,
      target_max_redemptions_per_tenant: input.maxRedemptionsPerTenant,
      target_membership_coverage_limit: input.membershipCoverageLimit,
      target_package_ids: input.packageIds
    }
  );
  const row = Array.isArray(data) ? data[0] : null;
  if (error || row?.result !== "CREATED") {
    fail(row?.result === "INVALID_PACKAGES"
      ? "Selecciona paquetes existentes que no estén archivados."
      : row?.result === "INVALID"
        ? "El código ya existe o alguna regla no es válida."
        : "No se pudo crear la promoción.");
  }

  revalidatePath(promotionsPath);
  redirect(`${promotionsPath}?created=1`);
}

export async function setBillingPromotionStatus(formData: FormData) {
  const promotionId = formData.get("promotionId");
  const status = formData.get("status");
  if (typeof promotionId !== "string" || !/^[0-9a-f-]{36}$/i.test(promotionId)) fail("La promoción no es válida.");
  if (status !== "ACTIVE" && status !== "ARCHIVED") fail("El estado solicitado no es válido.");

  const context = await getActiveSuperadminContext();
  if (!context) fail("No tienes permisos para administrar promociones.");
  const { data, error } = await context.supabase.schema("app").rpc(
    "set_billing_promotion_status",
    { target_promotion_id: promotionId, target_status: status }
  );
  if (error || !["ACTIVATED", "ARCHIVED", "UNCHANGED"].includes(String(data))) {
    fail(data === "INVALID"
      ? "Para activarla necesita un paquete activo y no puede estar vencida."
      : "No se pudo actualizar la promoción.");
  }

  revalidatePath(promotionsPath);
  redirect(`${promotionsPath}?status=${status}`);
}
