import type { FieldErrors, FormState } from "@/lib/forms/state";

export const creatableStaffRoles = ["MANAGER", "EMPLOYEE"] as const;
export type CreatableStaffRole = (typeof creatableStaffRoles)[number];

export type StaffCreateInput = {
  branchId: string;
  fullName: string;
  email: string;
  role: CreatableStaffRole;
  temporaryPassword: string;
};

export type StaffCreateValidationResult =
  | { ok: true; data: StaffCreateInput }
  | { ok: false; errors: string[] };

function text(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export function validateStaffCreateForm(
  formData: FormData
): StaffCreateValidationResult {
  const errors: string[] = [];
  const fullName = text(formData, "fullName");
  const branchId = text(formData, "branchId");
  const email = text(formData, "email").toLowerCase();
  const role = text(formData, "role");
  const temporaryPassword = formData.get("temporaryPassword");
  const passwordConfirmation = formData.get("passwordConfirmation");
  const password = typeof temporaryPassword === "string" ? temporaryPassword : "";
  const confirmation = typeof passwordConfirmation === "string" ? passwordConfirmation : "";

  if (!fullName) {
    errors.push("Nombre es obligatorio.");
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(branchId)) {
    errors.push("Sucursal es obligatoria.");
  }

  if (!email) {
    errors.push("Correo es obligatorio.");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("El correo no es válido.");
  }

  if (!creatableStaffRoles.includes(role as CreatableStaffRole)) {
    errors.push("El rol seleccionado no es válido.");
  }

  if (password.length < 12) {
    errors.push("La contraseña temporal debe tener al menos 12 caracteres.");
  }

  if (password.length > 72) {
    errors.push("La contraseña temporal no puede exceder 72 caracteres.");
  }

  if (password !== confirmation) {
    errors.push("La confirmación de contraseña no coincide.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      branchId,
      fullName,
      email,
      role: role as CreatableStaffRole,
      temporaryPassword: password
    }
  };
}

/* Guided staff creation (DEC-0073). */

export type StaffField = "fullName" | "email" | "role" | "branchId" | "temporaryPassword" | "passwordConfirmation" | "pin";
export type StaffCreateValues = { fullName: string; email: string; role: string; branchId: string };
export type StaffCreateActionState = FormState<StaffCreateValues, StaffField>;

export const STAFF_CREATE_STEP_FIELDS = [
  ["fullName", "email"],
  ["role", "branchId"],
  ["temporaryPassword", "passwordConfirmation"],
] as const satisfies readonly (readonly StaffField[])[];

export const PIN_OPERATOR_STEP_FIELDS = [["fullName"], ["pin"]] as const satisfies readonly (readonly StaffField[])[];

const STAFF_ERROR_FIELDS: Record<string, StaffField> = {
  "Nombre es obligatorio.": "fullName",
  "Sucursal es obligatoria.": "branchId",
  "Correo es obligatorio.": "email",
  "El correo no es válido.": "email",
  "El rol seleccionado no es válido.": "role",
  "La contraseña temporal debe tener al menos 12 caracteres.": "temporaryPassword",
  "La contraseña temporal no puede exceder 72 caracteres.": "temporaryPassword",
  "La confirmación de contraseña no coincide.": "passwordConfirmation",
};

/** Maps validator messages to their fields. */
export function staffFieldErrors(errors: readonly string[]): FieldErrors<StaffField> {
  const fieldErrors: FieldErrors<StaffField> = {};
  for (const message of errors) {
    const field = STAFF_ERROR_FIELDS[message];
    if (field) fieldErrors[field] = [...(fieldErrors[field] ?? []), message];
  }
  return fieldErrors;
}

export function staffCreateValues(formData: FormData): StaffCreateValues {
  return {
    fullName: text(formData, "fullName"),
    email: text(formData, "email"),
    role: text(formData, "role") || "EMPLOYEE",
    branchId: text(formData, "branchId"),
  };
}

function onlyFields(errors: FieldErrors<StaffField>, fields: readonly StaffField[]): FieldErrors {
  const picked: FieldErrors = {};
  for (const field of fields) if (errors[field]?.length) picked[field] = errors[field];
  return picked;
}

/** Client check for one step of the individual-account wizard. */
export function staffCreateStepErrors(formData: FormData, step: number): FieldErrors {
  const result = validateStaffCreateForm(formData);
  return result.ok ? {} : onlyFields(staffFieldErrors(result.errors), STAFF_CREATE_STEP_FIELDS[step] ?? []);
}

export function validatePinOperatorForm(formData: FormData): FieldErrors<StaffField> {
  const errors: FieldErrors<StaffField> = {};
  if (!text(formData, "fullName")) errors.fullName = ["Nombre es obligatorio."];
  const pin = formData.get("pin");
  if (typeof pin !== "string" || !/^[0-9]{6}$/.test(pin)) errors.pin = ["El PIN debe tener exactamente seis dígitos."];
  return errors;
}

/** Client check for one step of the PIN operator wizard. */
export function pinOperatorStepErrors(formData: FormData, step: number): FieldErrors {
  return onlyFields(validatePinOperatorForm(formData), PIN_OPERATOR_STEP_FIELDS[step] ?? []);
}
