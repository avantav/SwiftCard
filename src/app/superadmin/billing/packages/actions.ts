"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveSuperadminContext } from "@/lib/auth/server";
import { validateBillingPackageForm } from "@/lib/billing/packages";

const packagesPath = "/superadmin/billing/packages";

function fail(message: string): never {
  redirect(`${packagesPath}?error=${encodeURIComponent(message)}`);
}

export async function createBillingPackage(formData: FormData) {
  const validation = validateBillingPackageForm(formData);
  if (!validation.ok) fail(validation.errors[0] ?? "Datos inválidos.");

  const context = await getActiveSuperadminContext();
  if (!context) fail("No tienes permisos para administrar paquetes.");

  const input = validation.data;
  const { data, error } = await context.supabase.schema("app").rpc(
    "create_billing_package",
    {
      target_code: input.code,
      target_name: input.name,
      target_description: input.description,
      target_membership_limit: input.membershipLimit,
      target_branch_limit: input.branchLimit,
      target_loyalty_card_limit: input.loyaltyCardLimit,
      target_entitlements: input.entitlements,
      target_currency_code: input.currencyCode,
      target_billing_interval: input.billingInterval,
      target_amount_minor: input.amountMinor
    }
  );
  const row = Array.isArray(data) ? data[0] : null;
  if (error || row?.result !== "CREATED") {
    fail(row?.result === "INVALID"
      ? "El código ya existe o algún límite no es válido."
      : "No se pudo crear el paquete.");
  }

  revalidatePath(packagesPath);
  redirect(`${packagesPath}?created=1`);
}

export async function setBillingPackageStatus(formData: FormData) {
  const packageId = formData.get("packageId");
  const status = formData.get("status");
  if (typeof packageId !== "string" || !/^[0-9a-f-]{36}$/i.test(packageId)) {
    fail("El paquete no es válido.");
  }
  if (status !== "ACTIVE" && status !== "ARCHIVED") {
    fail("El estado solicitado no es válido.");
  }

  const context = await getActiveSuperadminContext();
  if (!context) fail("No tienes permisos para administrar paquetes.");

  const { data, error } = await context.supabase.schema("app").rpc(
    "set_billing_package_status",
    { target_package_id: packageId, target_status: status }
  );
  if (error || !["ACTIVATED", "ARCHIVED", "UNCHANGED"].includes(String(data))) {
    fail("No se pudo actualizar el paquete.");
  }

  revalidatePath(packagesPath);
  redirect(`${packagesPath}?status=${status}`);
}
