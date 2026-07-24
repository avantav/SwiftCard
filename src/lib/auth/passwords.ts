export type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
};

export type PasswordChangeValidationResult =
  | {
      ok: true;
      data: PasswordChangeInput;
    }
  | {
      ok: false;
      errors: string[];
    };

function passwordValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export function validatePasswordChangeForm(
  formData: FormData
): PasswordChangeValidationResult {
  const errors: string[] = [];
  const currentPassword = passwordValue(formData.get("currentPassword"));
  const newPassword = passwordValue(formData.get("newPassword"));
  const passwordConfirmation = passwordValue(
    formData.get("passwordConfirmation")
  );

  if (!currentPassword) {
    errors.push("La contraseña temporal es obligatoria.");
  }

  if (newPassword.length < 12) {
    errors.push("La nueva contraseña debe tener al menos 12 caracteres.");
  }

  if (newPassword.length > 72) {
    errors.push("La nueva contraseña no puede exceder 72 caracteres.");
  }

  if (newPassword !== passwordConfirmation) {
    errors.push("La confirmación de contraseña no coincide.");
  }

  if (currentPassword && newPassword === currentPassword) {
    errors.push("La nueva contraseña debe ser distinta a la temporal.");
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
      currentPassword,
      newPassword
    }
  };
}
