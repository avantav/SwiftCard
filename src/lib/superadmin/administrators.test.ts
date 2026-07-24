import { describe, expect, it, vi } from "vitest";
import {
  provisionFirstAdministrator,
  validateFirstAdministratorForm,
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
