export type FirstAdministratorInput = {
  fullName: string;
  email: string;
  temporaryPassword: string;
};

export type FirstAdministratorValidationResult =
  | {
      ok: true;
      data: FirstAdministratorInput;
    }
  | {
      ok: false;
      errors: string[];
    };

export type AdministratorProvisioningDependencies = {
  administratorExists: (tenantId: string) => Promise<boolean | null>;
  createAuthUser: (
    input: FirstAdministratorInput
  ) => Promise<{ userId: string } | null>;
  createStaffProfile: (profile: {
    id: string;
    tenantId: string;
    email: string;
    fullName: string;
    createdBy: string;
  }) => Promise<boolean>;
  deleteAuthUser: (userId: string) => Promise<boolean>;
};

export type AdministratorProvisioningResult =
  | {
      ok: true;
      userId: string;
    }
  | {
      ok: false;
      reason:
        | "ADMINISTRATOR_EXISTS"
        | "ADMINISTRATOR_CHECK_FAILED"
        | "AUTH_USER_CREATE_FAILED"
        | "PROFILE_CREATE_FAILED"
        | "PROFILE_CREATE_FAILED_CLEANUP_FAILED";
    };

function textValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function passwordValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export function validateFirstAdministratorForm(
  formData: FormData
): FirstAdministratorValidationResult {
  const errors: string[] = [];
  const fullName = textValue(formData.get("fullName"));
  const email = textValue(formData.get("email")).toLowerCase();
  const temporaryPassword = passwordValue(formData.get("temporaryPassword"));
  const passwordConfirmation = passwordValue(
    formData.get("passwordConfirmation")
  );

  if (!fullName) {
    errors.push("Nombre es obligatorio.");
  }

  if (!email) {
    errors.push("Correo es obligatorio.");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("El correo no es válido.");
  }

  if (temporaryPassword.length < 12) {
    errors.push("La contraseña temporal debe tener al menos 12 caracteres.");
  }

  if (temporaryPassword.length > 72) {
    errors.push("La contraseña temporal no puede exceder 72 caracteres.");
  }

  if (temporaryPassword !== passwordConfirmation) {
    errors.push("La confirmación de contraseña no coincide.");
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
      fullName,
      email,
      temporaryPassword
    }
  };
}

export async function provisionFirstAdministrator(
  tenantId: string,
  createdBy: string,
  input: FirstAdministratorInput,
  dependencies: AdministratorProvisioningDependencies
): Promise<AdministratorProvisioningResult> {
  const existingAdministrator =
    await dependencies.administratorExists(tenantId);

  if (existingAdministrator === null) {
    return {
      ok: false,
      reason: "ADMINISTRATOR_CHECK_FAILED"
    };
  }

  if (existingAdministrator) {
    return {
      ok: false,
      reason: "ADMINISTRATOR_EXISTS"
    };
  }

  const authUser = await dependencies.createAuthUser(input);

  if (!authUser) {
    return {
      ok: false,
      reason: "AUTH_USER_CREATE_FAILED"
    };
  }

  const profileCreated = await dependencies.createStaffProfile({
    id: authUser.userId,
    tenantId,
    email: input.email,
    fullName: input.fullName,
    createdBy
  });

  if (profileCreated) {
    return {
      ok: true,
      userId: authUser.userId
    };
  }

  const authUserDeleted = await dependencies.deleteAuthUser(authUser.userId);

  return {
    ok: false,
    reason: authUserDeleted
      ? "PROFILE_CREATE_FAILED"
      : "PROFILE_CREATE_FAILED_CLEANUP_FAILED"
  };
}
