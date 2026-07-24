import { normalizePhone } from "./phone";

export type PublicCustomerRegistrationInput = {
  fullName: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  privacyConsent: boolean;
};

export type PublicCustomerRegistrationValidationResult =
  | { ok: true; data: PublicCustomerRegistrationInput }
  | { ok: false; errors: string[] };

function value(formData: FormData, field: string) {
  const entry = formData.get(field);
  return typeof entry === "string" ? entry.trim() : "";
}

export function validatePublicCustomerRegistration(
  formData: FormData
): PublicCustomerRegistrationValidationResult {
  const errors: string[] = [];
  const fullName = value(formData, "fullName");
  const rawPhone = value(formData, "phone");
  const email = value(formData, "email");
  const birthDate = value(formData, "birthDate");

  if (!fullName) errors.push("Nombre es obligatorio.");

  const phone = normalizePhone(rawPhone);
  if (!phone.ok) errors.push(phone.error);

  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    errors.push("El correo no es válido.");
  }

  if (!formData.has("privacyConsent")) {
    errors.push("Debes aceptar el aviso de privacidad.");
  }

  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    errors.push("La fecha de nacimiento no es válida.");
  }

  if (errors.length > 0 || !phone.ok) return { ok: false, errors };

  return {
    ok: true,
    data: {
      fullName,
      phone: phone.value,
      email: email || null,
      birthDate: birthDate || null,
      privacyConsent: true
    }
  };
}
