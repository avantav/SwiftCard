import { normalizePhone } from "./phone";

export type EmployeeCustomerRegistrationInput = {
  fullName: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  privacyConsent: boolean;
};

export type EmployeeCustomerRegistrationResult =
  | { ok: true; data: EmployeeCustomerRegistrationInput }
  | { ok: false; errors: string[] };

export function validateEmployeeCustomerRegistration(
  formData: FormData
): EmployeeCustomerRegistrationResult {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const birthDate = String(formData.get("birthDate") ?? "").trim();
  const errors: string[] = [];

  if (!fullName) errors.push("Nombre es obligatorio.");
  const phone = normalizePhone(rawPhone);
  if (!phone.ok) errors.push(phone.error);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push("El correo no es válido.");
  if (!formData.has("privacyConsent")) errors.push("Debes aceptar el aviso de privacidad.");
  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) errors.push("La fecha de nacimiento no es válida.");

  if (errors.length || !phone.ok) return { ok: false, errors };
  return { ok: true, data: { fullName, phone: phone.value, email: email || null, birthDate: birthDate || null, privacyConsent: true } };
}
