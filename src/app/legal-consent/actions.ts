"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { LEGAL_VERSION } from "@/lib/legal/company";
import {
  legalConsentErrorMessage,
  safeLegalReturnPath,
  validateLegalProfile,
  type LegalConsentFormState,
} from "@/lib/legal/consent";

type ConsentArea = "ADMIN" | "APP";

function consentArea(value: unknown): ConsentArea {
  return value === "APP" ? "APP" : "ADMIN";
}

/** Any tenant staff member (or unlocked PIN operator) accepts as a user. */
export async function acceptPlatformLegalTerms(areaValue: ConsentArea, _previous: LegalConsentFormState, formData: FormData): Promise<LegalConsentFormState> {
  const area = consentArea(areaValue);
  const context = await requireInternalArea(area, { writable: true, allowPendingLegal: true });
  if (formData.get("acceptLegal") !== "on") {
    return { error: "Marca la casilla para aceptar los términos y continuar.", fieldErrors: { acceptLegal: "Es obligatorio aceptar para continuar." } };
  }
  const { error } = await context.supabase.schema("app").rpc("accept_platform_legal_terms", { required_version: LEGAL_VERSION });
  if (error) return { error: legalConsentErrorMessage(error.message) };
  redirect(safeLegalReturnPath(formData.get("returnTo"), area));
}

/** Admin general: legal identity of the business and acceptance, atomically. */
export async function completeAdminLegalOnboarding(_previous: LegalConsentFormState, formData: FormData): Promise<LegalConsentFormState> {
  const context = await requireInternalArea("ADMIN", { writable: true, allowPendingLegal: true });
  if (context.access.role !== "ADMIN") return { error: legalConsentErrorMessage("forbidden") };
  const validation = validateLegalProfile(formData);
  if ("state" in validation) return validation.state;
  if (formData.get("acceptLegal") !== "on") {
    return {
      error: "Marca la casilla para aceptar los términos y continuar.",
      fieldErrors: { acceptLegal: "Es obligatorio aceptar para continuar." },
      values: { ...validation.data, legalContactEmail: validation.data.legalContactEmail ?? "" },
    };
  }
  const { error } = await context.supabase.schema("app").rpc("complete_admin_legal_onboarding", {
    required_version: LEGAL_VERSION,
    target_legal_name: validation.data.legalName,
    target_legal_address: validation.data.legalAddress,
    target_legal_contact_email: validation.data.legalContactEmail ?? "",
  });
  if (error) {
    return { error: legalConsentErrorMessage(error.message), values: { ...validation.data, legalContactEmail: validation.data.legalContactEmail ?? "" } };
  }
  redirect(safeLegalReturnPath(formData.get("returnTo"), "ADMIN"));
}

/** Admin general edits the legal identity later from /admin/legal. */
export async function updateTenantLegalProfile(_previous: LegalConsentFormState, formData: FormData): Promise<LegalConsentFormState> {
  const context = await requireInternalArea("ADMIN", { writable: true });
  if (context.access.role !== "ADMIN") return { error: legalConsentErrorMessage("forbidden") };
  const validation = validateLegalProfile(formData);
  if ("state" in validation) return validation.state;
  const { error } = await context.supabase.schema("app").rpc("update_tenant_legal_profile", {
    target_legal_name: validation.data.legalName,
    target_legal_address: validation.data.legalAddress,
    target_legal_contact_email: validation.data.legalContactEmail ?? "",
  });
  if (error) {
    return { error: legalConsentErrorMessage(error.message), values: { ...validation.data, legalContactEmail: validation.data.legalContactEmail ?? "" } };
  }
  redirect("/admin/legal?saved=1");
}
