export type BranchCreateInput = {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
  proximityEnabled: boolean;
  employeeAccessMode: BranchEmployeeAccessMode;
  sharedEmail: string | null;
  sharedPassword: string | null;
};

export const BRANCH_EMPLOYEE_ACCESS_MODES = [
  "INDIVIDUAL_CREDENTIALS",
  "SHARED_ACCOUNT_PIN"
] as const;

export type BranchEmployeeAccessMode =
  (typeof BRANCH_EMPLOYEE_ACCESS_MODES)[number];

export type BranchCreateValidationResult =
  | { ok: true; data: BranchCreateInput }
  | { ok: false; errors: string[] };

function text(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function optionalCoordinate(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function validateBranchCreateForm(
  formData: FormData
): BranchCreateValidationResult {
  const errors: string[] = [];
  const name = text(formData, "name");
  const address = text(formData, "address") || null;
  const latitude = optionalCoordinate(text(formData, "latitude"));
  const longitude = optionalCoordinate(text(formData, "longitude"));
  const radius = Number(text(formData, "geofenceRadiusMeters"));
  const employeeAccessMode = text(formData, "employeeAccessMode") || "INDIVIDUAL_CREDENTIALS";
  const sharedEmail = text(formData, "sharedEmail").toLowerCase();
  const sharedPasswordValue = formData.get("sharedPassword");
  const sharedPassword = typeof sharedPasswordValue === "string" ? sharedPasswordValue : "";
  const sharedPasswordConfirmation = formData.get("sharedPasswordConfirmation");

  if (!name) {
    errors.push("Nombre es obligatorio.");
  }

  if ((latitude === null) !== (longitude === null)) {
    errors.push("Latitud y longitud deben capturarse juntas.");
  }

  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    errors.push("La latitud debe estar entre -90 y 90.");
  }

  if (
    longitude !== null &&
    (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
  ) {
    errors.push("La longitud debe estar entre -180 y 180.");
  }

  if (!Number.isInteger(radius) || radius < 1 || radius > 100000) {
    errors.push("El radio debe ser un entero entre 1 y 100000 metros.");
  }

  if (!BRANCH_EMPLOYEE_ACCESS_MODES.includes(employeeAccessMode as BranchEmployeeAccessMode)) {
    errors.push("El modo de acceso del personal no es válido.");
  }

  if (employeeAccessMode === "SHARED_ACCOUNT_PIN") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sharedEmail)) {
      errors.push("El correo compartido no es válido.");
    }
    if (sharedPassword.length < 12 || sharedPassword.length > 72) {
      errors.push("La contraseña compartida debe tener entre 12 y 72 caracteres.");
    }
    if (sharedPassword !== sharedPasswordConfirmation) {
      errors.push("La confirmación de la contraseña compartida no coincide.");
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      name,
      address,
      latitude,
      longitude,
      geofenceRadiusMeters: radius,
      proximityEnabled: formData.get("proximityEnabled") === "on",
      employeeAccessMode: employeeAccessMode as BranchEmployeeAccessMode,
      sharedEmail: employeeAccessMode === "SHARED_ACCOUNT_PIN" ? sharedEmail : null,
      sharedPassword: employeeAccessMode === "SHARED_ACCOUNT_PIN" ? sharedPassword : null
    }
  };
}

export function validateSharedAccessCredentials(formData: FormData) {
  const email = text(formData, "sharedEmail").toLowerCase();
  const passwordValue = formData.get("sharedPassword");
  const confirmationValue = formData.get("sharedPasswordConfirmation");
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const confirmation = typeof confirmationValue === "string" ? confirmationValue : "";
  const errors: string[] = [];

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("El correo compartido no es válido.");
  }
  if (password.length < 12 || password.length > 72) {
    errors.push("La contraseña compartida debe tener entre 12 y 72 caracteres.");
  }
  if (password !== confirmation) {
    errors.push("La confirmación de la contraseña compartida no coincide.");
  }

  return errors.length ? { ok: false as const, errors } : { ok: true as const, data: { email, password } };
}
