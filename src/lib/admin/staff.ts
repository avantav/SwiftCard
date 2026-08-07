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
