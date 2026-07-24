"use server";

import { redirect } from "next/navigation";
import { validatePublicCustomerRegistration } from "@/lib/customers/registration";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function registrationRedirect(branchToken: string, params: Record<string, string>): never {
  redirect(`/register/${encodeURIComponent(branchToken)}?${new URLSearchParams(params).toString()}`);
}

export async function registerCustomer(branchToken: string, formData: FormData) {
  const validation = validatePublicCustomerRegistration(formData);
  if (!validation.ok) registrationRedirect(branchToken, { error: validation.errors.join(" ") });

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    registrationRedirect(branchToken, { error: "El registro no está disponible." });
  }

  const { data, error } = await supabase.rpc("register_public_customer", {
    target_branch_token: branchToken,
    target_full_name: validation.data.fullName,
    target_normalized_phone: validation.data.phone,
    target_email: validation.data.email ?? "",
    target_birth_date: validation.data.birthDate,
    target_privacy_consent: validation.data.privacyConsent
  });
  const result = Array.isArray(data) ? data[0] : null;

  if (error || !result || typeof result.result !== "string") {
    registrationRedirect(branchToken, { error: "El registro no está disponible." });
  }
  if (result.result === "DUPLICATE") registrationRedirect(branchToken, { duplicate: "1" });
  if (result.result !== "CREATED" || typeof result.card_token !== "string") {
    registrationRedirect(branchToken, { error: "La sucursal no está disponible." });
  }
  registrationRedirect(branchToken, { created: "1", cardToken: result.card_token });
}
