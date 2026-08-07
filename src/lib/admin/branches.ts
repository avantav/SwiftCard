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

export type BranchCreateField =
  | "name"
  | "address"
  | "latitude"
  | "longitude"
  | "geofenceRadiusMeters"
  | "proximityEnabled"
  | "employeeAccessMode"
  | "sharedEmail"
  | "sharedPassword"
  | "sharedPasswordConfirmation";

export type BranchCreateFieldErrors = Partial<
  Record<BranchCreateField, string[]>
>;

export type BranchCreateFormValues = {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  geofenceRadiusMeters: string;
  proximityEnabled: boolean;
  employeeAccessMode: BranchEmployeeAccessMode;
  sharedEmail: string;
};

export type BranchCreateActionState = {
  status: "idle" | "error";
  formError: string | null;
  fieldErrors: BranchCreateFieldErrors;
  values: BranchCreateFormValues;
};

export const BRANCH_EMPLOYEE_ACCESS_MODES = [
  "INDIVIDUAL_CREDENTIALS",
  "SHARED_ACCOUNT_PIN"
] as const;

export type BranchEmployeeAccessMode =
  (typeof BRANCH_EMPLOYEE_ACCESS_MODES)[number];

export type BranchCreateValidationResult =
  | { ok: true; data: BranchCreateInput }
  | {
      ok: false;
      errors: string[];
      fieldErrors: BranchCreateFieldErrors;
      values: BranchCreateFormValues;
    };

export const INITIAL_BRANCH_CREATE_STATE: BranchCreateActionState = {
  status: "idle",
  formError: null,
  fieldErrors: {},
  values: {
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    geofenceRadiusMeters: "100",
    proximityEnabled: true,
    employeeAccessMode: "INDIVIDUAL_CREDENTIALS",
    sharedEmail: "",
  },
};

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
  const issues: Array<{ field: BranchCreateField; message: string }> = [];
  const name = text(formData, "name");
  const addressValue = text(formData, "address");
  const address = addressValue || null;
  const latitudeValue = text(formData, "latitude");
  const longitudeValue = text(formData, "longitude");
  const radiusValue = text(formData, "geofenceRadiusMeters");
  const latitude = optionalCoordinate(latitudeValue);
  const longitude = optionalCoordinate(longitudeValue);
  const radius = Number(radiusValue);
  const rawEmployeeAccessMode =
    text(formData, "employeeAccessMode") || "INDIVIDUAL_CREDENTIALS";
  const employeeAccessMode = BRANCH_EMPLOYEE_ACCESS_MODES.includes(
    rawEmployeeAccessMode as BranchEmployeeAccessMode,
  )
    ? (rawEmployeeAccessMode as BranchEmployeeAccessMode)
    : "INDIVIDUAL_CREDENTIALS";
  const sharedEmail = text(formData, "sharedEmail").toLowerCase();
  const sharedPasswordValue = formData.get("sharedPassword");
  const sharedPassword = typeof sharedPasswordValue === "string" ? sharedPasswordValue : "";
  const sharedPasswordConfirmation = formData.get("sharedPasswordConfirmation");
  const values: BranchCreateFormValues = {
    name,
    address: addressValue,
    latitude: latitudeValue,
    longitude: longitudeValue,
    geofenceRadiusMeters: radiusValue,
    proximityEnabled: formData.get("proximityEnabled") === "on",
    employeeAccessMode,
    sharedEmail,
  };

  function addIssue(field: BranchCreateField, message: string) {
    issues.push({ field, message });
  }

  if (!name) {
    addIssue("name", "El nombre de la sucursal es obligatorio.");
  } else if (name.length < 2) {
    addIssue("name", "El nombre debe tener al menos 2 caracteres.");
  } else if (name.length > 120) {
    addIssue("name", "El nombre no puede exceder 120 caracteres.");
  }

  if (addressValue.length > 300) {
    addIssue("address", "La dirección no puede exceder 300 caracteres.");
  }

  if ((latitude === null) !== (longitude === null)) {
    if (latitude === null) {
      addIssue("latitude", "Captura la latitud junto con la longitud.");
    }
    if (longitude === null) {
      addIssue("longitude", "Captura la longitud junto con la latitud.");
    }
  }

  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    addIssue("latitude", "La latitud debe ser un número entre -90 y 90.");
  }

  if (
    longitude !== null &&
    (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
  ) {
    addIssue("longitude", "La longitud debe ser un número entre -180 y 180.");
  }

  if (!Number.isInteger(radius) || radius < 1 || radius > 100000) {
    addIssue(
      "geofenceRadiusMeters",
      "El radio debe ser un número entero entre 1 y 100000 metros.",
    );
  }

  if (
    !BRANCH_EMPLOYEE_ACCESS_MODES.includes(
      rawEmployeeAccessMode as BranchEmployeeAccessMode,
    )
  ) {
    addIssue("employeeAccessMode", "Selecciona un modo de acceso válido.");
  }

  if (rawEmployeeAccessMode === "SHARED_ACCOUNT_PIN") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sharedEmail)) {
      addIssue("sharedEmail", "Captura un correo compartido válido.");
    } else if (sharedEmail.length > 254) {
      addIssue("sharedEmail", "El correo no puede exceder 254 caracteres.");
    }
    if (sharedPassword.length < 12 || sharedPassword.length > 72) {
      addIssue(
        "sharedPassword",
        "La contraseña compartida debe tener entre 12 y 72 caracteres.",
      );
    }
    if (sharedPassword !== sharedPasswordConfirmation) {
      addIssue(
        "sharedPasswordConfirmation",
        "La confirmación no coincide con la contraseña compartida.",
      );
    }
  }

  if (issues.length > 0) {
    const fieldErrors: BranchCreateFieldErrors = {};
    for (const issue of issues) {
      fieldErrors[issue.field] = [
        ...(fieldErrors[issue.field] ?? []),
        issue.message,
      ];
    }
    return {
      ok: false,
      errors: issues.map((issue) => issue.message),
      fieldErrors,
      values,
    };
  }

  return {
    ok: true,
    data: {
      name,
      address,
      latitude,
      longitude,
      geofenceRadiusMeters: radius,
      proximityEnabled: values.proximityEnabled,
      employeeAccessMode,
      sharedEmail: employeeAccessMode === "SHARED_ACCOUNT_PIN" ? sharedEmail : null,
      sharedPassword: employeeAccessMode === "SHARED_ACCOUNT_PIN" ? sharedPassword : null
    }
  };
}

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string;
};

export function describeBranchPersistenceError(
  error: SupabaseErrorLike | null,
): Pick<BranchCreateActionState, "formError" | "fieldErrors"> {
  const rawCode = error?.code?.trim() ?? "";
  const code = /^[A-Z0-9_]{1,32}$/.test(rawCode) ? rawCode : "UNKNOWN";
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();

  if (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("connection")
  ) {
    return {
      formError:
        "El servidor no pudo comunicarse con Supabase. Revisa la conexión y vuelve a intentarlo.",
      fieldErrors: {},
    };
  }

  if (code === "42501" || message.includes("row-level security")) {
    return {
      formError:
        "Tu sesión no tiene permiso para crear sucursales. Cierra sesión, vuelve a entrar con el Admin general e inténtalo nuevamente.",
      fieldErrors: {},
    };
  }

  if (
    code === "PGRST204" ||
    code === "PGRST202" ||
    code === "42703" ||
    code === "42883" ||
    message.includes("employee_access_mode")
  ) {
    return {
      formError:
        "La base de datos no tiene disponible la configuración de acceso por sucursal. Verifica que la migración 0035 esté aplicada y recarga el esquema de Supabase.",
      fieldErrors: { employeeAccessMode: ["Este campo aún no está disponible en la base de datos."] },
    };
  }

  if (code === "23514" && message.includes("branches_name_not_blank")) {
    return {
      formError: "La base de datos rechazó el nombre de la sucursal.",
      fieldErrors: { name: ["Captura un nombre que no esté vacío."] },
    };
  }

  if (code === "23514" && message.includes("latitude")) {
    return {
      formError: "La base de datos rechazó la ubicación de la sucursal.",
      fieldErrors: { latitude: ["La latitud debe estar entre -90 y 90."] },
    };
  }

  if (code === "23514" && message.includes("longitude")) {
    return {
      formError: "La base de datos rechazó la ubicación de la sucursal.",
      fieldErrors: { longitude: ["La longitud debe estar entre -180 y 180."] },
    };
  }

  if (code === "23514" && message.includes("geofence")) {
    return {
      formError: "La base de datos rechazó el radio operativo.",
      fieldErrors: {
        geofenceRadiusMeters: ["El radio debe ser mayor que cero."],
      },
    };
  }

  if (code === "23505" && message.includes("registration_token")) {
    return {
      formError:
        "No se pudo generar un enlace público único para la sucursal. Vuelve a intentarlo.",
      fieldErrors: {},
    };
  }

  if (code === "23505" && message.includes("email")) {
    return {
      formError: "No se pudo configurar la cuenta compartida.",
      fieldErrors: {
        sharedEmail: [
          "Este correo ya está asignado a otra cuenta del sistema.",
        ],
      },
    };
  }

  if (code === "PGRST301" || code === "401") {
    return {
      formError:
        "La sesión expiró antes de guardar. Actualiza la página, inicia sesión nuevamente y repite el envío.",
      fieldErrors: {},
    };
  }

  return {
    formError: `Supabase rechazó la creación de la sucursal (código ${code}). Revisa los campos marcados o comparte este código con soporte.`,
    fieldErrors: {},
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
