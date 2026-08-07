export const tenantStatuses = ["ACTIVE", "SUSPENDED"] as const;
export const brandingModes = ["STANDARD", "WHITE_LABEL"] as const;

export type TenantStatusInput = (typeof tenantStatuses)[number];
export type BrandingModeInput = (typeof brandingModes)[number];

export function validateBrandingForm(formData: FormData) {
  const mode = formData.get("brandingMode");
  const primaryColor = String(formData.get("primaryColor") ?? "").trim();
  const secondaryColor = String(formData.get("secondaryColor") ?? "").trim();
  const logoUrl = optionalText(formData.get("logoUrl"));
  const bannerUrl = optionalText(formData.get("bannerUrl"));
  const errors: string[] = [];
  if (!brandingModes.includes(mode as BrandingModeInput)) errors.push("El modo de branding no es válido.");
  if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) errors.push("El color primario no es válido.");
  if (!/^#[0-9a-fA-F]{6}$/.test(secondaryColor)) errors.push("El color secundario no es válido.");
  for (const url of [logoUrl, bannerUrl]) if (url && !/^https:\/\//i.test(url)) errors.push("Las imágenes deben usar URLs HTTPS.");
  return errors.length ? { ok: false as const, errors } : { ok: true as const, data: { brandingMode: mode as BrandingModeInput, primaryColor: primaryColor.toUpperCase(), secondaryColor: secondaryColor.toUpperCase(), logoUrl, bannerUrl } };
}

export type TenantCreateInput = {
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: TenantStatusInput;
  currencyCode: string;
  timezone: string;
  brandingMode: BrandingModeInput;
  primaryColor: string;
  secondaryColor: string;
};

export type TenantCreateValidationResult =
  | {
      ok: true;
      data: TenantCreateInput;
    }
  | {
      ok: false;
      errors: string[];
    };

function optionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredText(
  formData: FormData,
  field: string,
  label: string,
  errors: string[]
) {
  const value = optionalText(formData.get(field));

  if (!value) {
    errors.push(`${label} es obligatorio.`);
    return "";
  }

  return value;
}

function normalizeEnum<T extends readonly string[]>(
  value: FormDataEntryValue | null,
  allowed: T,
  fallback: T[number]
) {
  if (typeof value !== "string") {
    return fallback;
  }

  return allowed.includes(value) ? (value as T[number]) : fallback;
}

function normalizeColor(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toUpperCase() : fallback;
}

export function validateTenantCreateForm(
  formData: FormData
): TenantCreateValidationResult {
  const errors: string[] = [];
  const name = requiredText(formData, "name", "Nombre", errors);
  const timezone = requiredText(formData, "timezone", "Zona horaria", errors);
  const currencyCode = requiredText(formData, "currencyCode", "Moneda", errors)
    .toUpperCase()
    .slice(0, 3);
  const contactEmail = optionalText(formData.get("contactEmail"));

  if (currencyCode.length > 0 && currencyCode.length !== 3) {
    errors.push("La moneda debe usar código ISO de 3 letras.");
  }

  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    errors.push("El correo de contacto no es válido.");
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors
    };
  }

  return {
    ok: true,
    data: {
      name,
      contactName: optionalText(formData.get("contactName")),
      contactEmail,
      contactPhone: optionalText(formData.get("contactPhone")),
      status: normalizeEnum(formData.get("status"), tenantStatuses, "ACTIVE"),
      currencyCode,
      timezone,
      brandingMode: normalizeEnum(
        formData.get("brandingMode"),
        brandingModes,
        "STANDARD"
      ),
      primaryColor: normalizeColor(formData.get("primaryColor"), "#149C91"),
      secondaryColor: normalizeColor(formData.get("secondaryColor"), "#17202A")
    }
  };
}
