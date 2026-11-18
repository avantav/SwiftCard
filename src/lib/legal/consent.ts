/**
 * Staff acceptance of the platform legal documents (DEC-0072). Pure helpers
 * shared by the server gate, the server actions and the modal.
 */

export type LegalConsentStatus = {
  acceptanceRequired: boolean;
  companyInfoRequired: boolean;
  /** Admin general: accepts for the business and edits its legal identity. */
  canEditCompany: boolean;
  tenantName: string;
  legalName: string | null;
  legalAddress: string | null;
  legalContactEmail: string | null;
  contactEmail: string | null;
};

export type LegalConsentFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"legalName" | "legalAddress" | "legalContactEmail" | "acceptLegal", string>>;
  values?: { legalName: string; legalAddress: string; legalContactEmail: string };
};

export type LegalProfileInput = { legalName: string; legalAddress: string; legalContactEmail: string | null };

const text = (value: unknown) => (typeof value === "string" ? value : null);

/** Parses the `app.get_my_legal_status` row; null when nothing applies. */
export function parseLegalConsentStatus(data: unknown): LegalConsentStatus | null {
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (typeof record.acceptance_required !== "boolean" || typeof record.company_info_required !== "boolean") return null;
  return {
    acceptanceRequired: record.acceptance_required,
    companyInfoRequired: record.company_info_required,
    canEditCompany: record.can_edit_company === true,
    tenantName: text(record.tenant_name) ?? "tu negocio",
    legalName: text(record.legal_name),
    legalAddress: text(record.legal_address),
    legalContactEmail: text(record.legal_contact_email),
    contactEmail: text(record.contact_email),
  };
}

export function legalConsentPending(status: LegalConsentStatus | null) {
  return Boolean(status && (status.acceptanceRequired || status.companyInfoRequired));
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateLegalProfile(formData: FormData): { data: LegalProfileInput } | { state: LegalConsentFormState } {
  const values = {
    legalName: String(formData.get("legalName") ?? "").trim().replace(/\s+/g, " "),
    legalAddress: String(formData.get("legalAddress") ?? "").trim().replace(/\s+/g, " "),
    legalContactEmail: String(formData.get("legalContactEmail") ?? "").trim().toLowerCase(),
  };
  const fieldErrors: LegalConsentFormState["fieldErrors"] = {};
  if (values.legalName.length < 2 || values.legalName.length > 200) {
    fieldErrors.legalName = "Escribe la razón social o el nombre completo del titular (de 2 a 200 caracteres).";
  }
  if (values.legalAddress.length < 10 || values.legalAddress.length > 400) {
    fieldErrors.legalAddress = "Escribe el domicilio completo: calle, número, colonia, código postal, ciudad y estado.";
  }
  if (values.legalContactEmail && (values.legalContactEmail.length > 254 || !EMAIL_PATTERN.test(values.legalContactEmail))) {
    fieldErrors.legalContactEmail = "Escribe un correo válido o deja el campo vacío.";
  }
  if (Object.keys(fieldErrors).length) return { state: { error: "Revisa los campos marcados.", fieldErrors, values } };
  return { data: { legalName: values.legalName, legalAddress: values.legalAddress, legalContactEmail: values.legalContactEmail || null } };
}

/** Maps RPC errors to messages; never exposes database details. */
export function legalConsentErrorMessage(message: string | undefined) {
  if (message?.includes("legal_name_invalid")) return "La razón social no es válida.";
  if (message?.includes("legal_address_invalid")) return "El domicilio no es válido.";
  if (message?.includes("legal_email_invalid")) return "El correo para privacidad no es válido.";
  if (message?.includes("legal_profile_incomplete")) return "Completa la razón social y el domicilio del negocio antes de aceptar.";
  if (message?.includes("forbidden")) return "Tu cuenta no puede realizar esta acción.";
  return "No se pudo guardar la aceptación. Intenta de nuevo.";
}

/** Only in-app destinations are allowed after accepting. */
export function safeLegalReturnPath(value: FormDataEntryValue | null, area: "ADMIN" | "APP") {
  const fallback = area === "ADMIN" ? "/admin" : "/app";
  if (typeof value !== "string" || value.length > 512 || value.startsWith("//") || value.includes("\\")) return fallback;
  const prefix = fallback;
  return value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`) ? value : fallback;
}
