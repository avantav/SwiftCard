"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveSuperadminContext } from "@/lib/auth/server";
import { validateBillingAffiliateForm } from "@/lib/billing/affiliates";

const affiliatesPath = "/superadmin/billing/affiliates";

function fail(message: string): never {
  redirect(`${affiliatesPath}?error=${encodeURIComponent(message)}`);
}

export async function createBillingAffiliate(formData: FormData) {
  const validation = validateBillingAffiliateForm(formData);
  if (!validation.ok) fail(validation.errors[0] ?? "Datos inválidos.");

  const context = await getActiveSuperadminContext();
  if (!context) fail("No tienes permisos para administrar afiliados.");
  const input = validation.data;
  const { data, error } = await context.supabase.schema("app").rpc(
    "create_billing_affiliate",
    {
      target_code: input.code,
      target_display_name: input.displayName,
      target_contact_email: input.contactEmail,
      target_commission_type: input.commissionType,
      target_commission_basis_points: input.commissionBasisPoints,
      target_commission_amount_minor: input.commissionAmountMinor,
      target_currency_code: input.currencyCode,
      target_attribution_window_days: input.attributionWindowDays
    }
  );
  const row = Array.isArray(data) ? data[0] : null;
  if (error || row?.result !== "CREATED") {
    fail(row?.result === "INVALID"
      ? "El código ya existe o alguna regla no es válida."
      : "No se pudo crear el afiliado.");
  }

  revalidatePath(affiliatesPath);
  redirect(`${affiliatesPath}?created=1`);
}

export async function setBillingAffiliateStatus(formData: FormData) {
  const affiliateId = formData.get("affiliateId");
  const status = formData.get("status");
  if (typeof affiliateId !== "string" || !/^[0-9a-f-]{36}$/i.test(affiliateId)) fail("El afiliado no es válido.");
  if (status !== "ACTIVE" && status !== "ARCHIVED") fail("El estado solicitado no es válido.");

  const context = await getActiveSuperadminContext();
  if (!context) fail("No tienes permisos para administrar afiliados.");
  const { data, error } = await context.supabase.schema("app").rpc(
    "set_billing_affiliate_status",
    { target_affiliate_id: affiliateId, target_status: status }
  );
  if (error || !["ACTIVATED", "ARCHIVED", "UNCHANGED"].includes(String(data))) fail("No se pudo actualizar el afiliado.");

  revalidatePath(affiliatesPath);
  redirect(`${affiliatesPath}?status=${status}`);
}
