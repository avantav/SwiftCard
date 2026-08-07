import { describe, expect, it, vi } from "vitest";
import {
  provisionFirstAdministrator,
  resetAdministratorTemporaryPassword,
  validateFirstAdministratorForm,
  validateTemporaryPasswordForm,
  type AdministratorProvisioningDependencies
} from "./administrators";

function form(values: Record<string, string>) {
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    formData.set(key, value);
  });

  return formData;
}

function dependencies(
  overrides: Partial<AdministratorProvisioningDependencies> = {}
): AdministratorProvisioningDependencies {
  return {
    administratorExists: vi.fn().mockResolvedValue(false),
    createAuthUser: vi.fn().mockResolvedValue({ userId: "auth-user-id" }),
    createStaffProfile: vi.fn().mockResolvedValue(true),
    deleteAuthUser: vi.fn().mockResolvedValue(true),
    ...overrides
  };
}

describe("validateFirstAdministratorForm", () => {
  it("normalizes valid input", () => {
    const result = validateFirstAdministratorForm(
      form({
        fullName: "  Ana Admin  ",
        email: "  ANA@EXAMPLE.TEST ",
        temporaryPassword: "Temporary-1234",
        passwordConfirmation: "Temporary-1234"
      })
    );

    expect(result).toEqual({
      ok: true,
      data: {
        fullName: "Ana Admin",
        email: "ana@example.test",
        temporaryPassword: "Temporary-1234"
      }
    });
  });

  it("rejects missing, invalid, short, and mismatched values", () => {
    const result = validateFirstAdministratorForm(
      form({
        email: "invalid",
        temporaryPassword: "short",
        passwordConfirmation: "different"
      })
    );

    expect(result).toMatchObject({
      ok: false,
      errors: [
        "Nombre es obligatorio.",
        "El correo no es válido.",
        "La contraseña temporal debe tener al menos 12 caracteres.",
        "La confirmación de contraseña no coincide."
      ]
    });
  });
});

describe("validateTemporaryPasswordForm", () => {
  it("accepts a matching temporary password", () => {
    const result = validateTemporaryPasswordForm(
      form({
        temporaryPassword: "Replacement-1234",
        passwordConfirmation: "Replacement-1234"
      })
    );

    expect(result).toEqual({
      ok: true,
      data: {
        temporaryPassword: "Replacement-1234"
      }
    });
  });

  it("rejects a short or mismatched temporary password", () => {
    const result = validateTemporaryPasswordForm(
      form({
        temporaryPassword: "short",
        passwordConfirmation: "different"
      })
    );

    expect(result).toMatchObject({
      ok: false,
      errors: [
        "La contraseña temporal debe tener al menos 12 caracteres.",
        "La confirmación de contraseña no coincide."
      ]
    });
  });
});

describe("provisionFirstAdministrator", () => {
  const input = {
    fullName: "Ana Admin",
    email: "ana@example.test",
    temporaryPassword: "Temporary-1234"
  };

  it("creates the Auth user and password-reset-required staff profile", async () => {
    const deps = dependencies();

    const result = await provisionFirstAdministrator(
      "tenant-id",
      "superadmin-id",
      input,
      deps
    );

    expect(result).toEqual({ ok: true, userId: "auth-user-id" });
    expect(deps.createStaffProfile).toHaveBeenCalledWith({
      id: "auth-user-id",
      tenantId: "tenant-id",
      email: "ana@example.test",
      fullName: "Ana Admin",
      createdBy: "superadmin-id"
    });
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("does not create another first Administrator", async () => {
    const deps = dependencies({
      administratorExists: vi.fn().mockResolvedValue(true)
    });

    const result = await provisionFirstAdministrator(
      "tenant-id",
      "superadmin-id",
      input,
      deps
    );

    expect(result).toEqual({ ok: false, reason: "ADMINISTRATOR_EXISTS" });
    expect(deps.createAuthUser).not.toHaveBeenCalled();
  });

  it("fails closed when the existing Administrator check fails", async () => {
    const deps = dependencies({
      administratorExists: vi.fn().mockResolvedValue(null)
    });

    const result = await provisionFirstAdministrator(
      "tenant-id",
      "superadmin-id",
      input,
      deps
    );

    expect(result).toEqual({
      ok: false,
      reason: "ADMINISTRATOR_CHECK_FAILED"
    });
    expect(deps.createAuthUser).not.toHaveBeenCalled();
  });

  it("deletes the Auth user when staff profile creation fails", async () => {
    const deps = dependencies({
      createStaffProfile: vi.fn().mockResolvedValue(false)
    });

    const result = await provisionFirstAdministrator(
      "tenant-id",
      "superadmin-id",
      input,
      deps
    );

    expect(result).toEqual({ ok: false, reason: "PROFILE_CREATE_FAILED" });
    expect(deps.deleteAuthUser).toHaveBeenCalledWith("auth-user-id");
  });

  it("reports a failed compensation explicitly", async () => {
    const deps = dependencies({
      createStaffProfile: vi.fn().mockResolvedValue(false),
      deleteAuthUser: vi.fn().mockResolvedValue(false)
    });

    const result = await provisionFirstAdministrator(
      "tenant-id",
      "superadmin-id",
      input,
      deps
    );

    expect(result).toEqual({
      ok: false,
      reason: "PROFILE_CREATE_FAILED_CLEANUP_FAILED"
    });
  });
});

describe("resetAdministratorTemporaryPassword", () => {
  it("blocks the profile before updating the Auth password", async () => {
    const calls: string[] = [];

    const result = await resetAdministratorTemporaryPassword(
      "tenant-id",
      "administrator-id",
      "Replacement-1234",
      {
        async markPasswordResetRequired() {
          calls.push("mark-profile");
          return true;
        },
        async updateAuthPassword() {
          calls.push("update-auth");
          return true;
        }
      }
    );

    expect(result).toEqual({ ok: true });
    expect(calls).toEqual(["mark-profile", "update-auth"]);
  });

  it("does not update Auth when the profile cannot be blocked", async () => {
    const updateAuthPassword = vi.fn().mockResolvedValue(true);

    const result = await resetAdministratorTemporaryPassword(
      "tenant-id",
      "administrator-id",
      "Replacement-1234",
      {
        markPasswordResetRequired: vi.fn().mockResolvedValue(false),
        updateAuthPassword
      }
    );

    expect(result).toEqual({ ok: false, reason: "PROFILE_MARK_FAILED" });
    expect(updateAuthPassword).not.toHaveBeenCalled();
  });

  it("reports Auth failure while leaving the profile blocked", async () => {
    const result = await resetAdministratorTemporaryPassword(
      "tenant-id",
      "administrator-id",
      "Replacement-1234",
      {
        markPasswordResetRequired: vi.fn().mockResolvedValue(true),
        updateAuthPassword: vi.fn().mockResolvedValue(false)
      }
    );

    expect(result).toEqual({
      ok: false,
      reason: "AUTH_PASSWORD_UPDATE_FAILED_PROFILE_BLOCKED"
    });
  });
});
