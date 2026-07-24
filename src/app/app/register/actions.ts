"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { validateEmployeeCustomerRegistration } from "@/lib/customers/employee-registration";

function redirectWithParams(params: Record<string, string>): never {
  redirect(`/app/register?${new URLSearchParams(params).toString()}`);
}

export async function registerEmployeeCustomer(formData: FormData) {
  const branchId = formData.get("branchId");
  const validation = validateEmployeeCustomerRegistration(formData);
  if (typeof branchId !== "string" || !branchId) {
    redirectWithParams({ error: "Selecciona una sucursal." });
  }
  if (!validation.ok) redirectWithParams({ error: validation.errors.join(" ") });

  const context = await requireInternalArea("APP");
  const { data, error } = await context.supabase.rpc("register_employee_customer", {
    target_branch_id: branchId,
    target_full_name: validation.data.fullName,
    target_normalized_phone: validation.data.phone,
    target_email: validation.data.email ?? "",
    target_birth_date: validation.data.birthDate,
    target_privacy_consent: validation.data.privacyConsent
  });
  const result = Array.isArray(data) ? data[0] : null;

  if (error || !result || typeof result.result !== "string") redirectWithParams({ error: "No se pudo registrar el cliente." });
  if (result.result === "DUPLICATE") redirectWithParams({ duplicate: "1" });
  if (result.result !== "CREATED" || typeof result.card_token !== "string") redirectWithParams({ error: "No tienes acceso a esa sucursal." });
  redirectWithParams({ created: "1", cardToken: result.card_token });
}
