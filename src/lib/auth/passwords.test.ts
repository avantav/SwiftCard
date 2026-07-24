import { describe, expect, it } from "vitest";
import { validatePasswordChangeForm } from "./passwords";

function form(values: Record<string, string>) {
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    formData.set(key, value);
  });

  return formData;
}

describe("validatePasswordChangeForm", () => {
  it("accepts a distinct matching password", () => {
    expect(
      validatePasswordChangeForm(
        form({
          currentPassword: "Temporary-1234",
          newPassword: "Permanent-5678",
          passwordConfirmation: "Permanent-5678"
        })
      )
    ).toEqual({
      ok: true,
      data: {
        currentPassword: "Temporary-1234",
        newPassword: "Permanent-5678"
      }
    });
  });

  it("rejects missing, short, and mismatched values", () => {
    expect(
      validatePasswordChangeForm(
        form({
          newPassword: "short",
          passwordConfirmation: "different"
        })
      )
    ).toMatchObject({
      ok: false,
      errors: [
        "La contraseña temporal es obligatoria.",
        "La nueva contraseña debe tener al menos 12 caracteres.",
        "La confirmación de contraseña no coincide."
      ]
    });
  });

  it("rejects reusing the temporary password", () => {
    expect(
      validatePasswordChangeForm(
        form({
          currentPassword: "Temporary-1234",
          newPassword: "Temporary-1234",
          passwordConfirmation: "Temporary-1234"
        })
      )
    ).toMatchObject({
      ok: false,
      errors: ["La nueva contraseña debe ser distinta a la temporal."]
    });
  });
});
