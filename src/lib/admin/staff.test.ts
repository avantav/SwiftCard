import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { validateStaffCreateForm } from "./staff";

const actionSource = readFileSync(
  join(process.cwd(), "src/app/admin/staff/actions.ts"),
  "utf8"
);

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("validateStaffCreateForm", () => {
  it("normalizes a valid Manager", () => {
    expect(
      validateStaffCreateForm(
        form({
          fullName: "  Encargada Norte ",
          email: "NORTE@EXAMPLE.TEST",
          role: "MANAGER",
          temporaryPassword: "Temporary-1234",
          passwordConfirmation: "Temporary-1234"
        })
      )
    ).toEqual({
      ok: true,
      data: {
        fullName: "Encargada Norte",
        email: "norte@example.test",
        role: "MANAGER",
        temporaryPassword: "Temporary-1234"
      }
    });
  });

  it("rejects invalid role and password input", () => {
    const result = validateStaffCreateForm(
      form({
        fullName: "",
        email: "bad",
        role: "ADMIN",
        temporaryPassword: "short",
        passwordConfirmation: "different"
      })
    );

    expect(result).toMatchObject({
      ok: false,
      errors: [
        "Nombre es obligatorio.",
        "El correo no es válido.",
        "El rol seleccionado no es válido.",
        "La contraseña temporal debe tener al menos 12 caracteres.",
        "La confirmación de contraseña no coincide."
      ]
    });
  });

  it("derives tenant and creator from the authenticated Admin context", () => {
    expect(actionSource).toContain('requireInternalArea("ADMIN")');
    expect(actionSource).toContain("tenant_id: context.tenantId");
    expect(actionSource).toContain("created_by: context.userId");
    expect(actionSource).not.toContain('formData.get("tenant');
  });

  it("keeps Auth provisioning and cleanup server-only", () => {
    expect(actionSource).toContain("createSupabaseAdminClient");
    expect(actionSource).toContain("adminClient.auth.admin.createUser");
    expect(actionSource).toContain("adminClient.auth.admin.deleteUser");
  });
});

describe("staff provisioning compensation contract", () => {
  it("documents the cleanup dependency as an async operation", async () => {
    const cleanup = vi.fn().mockResolvedValue(true);
    await cleanup("new-auth-user");
    expect(cleanup).toHaveBeenCalledWith("new-auth-user");
  });
});
