import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { staffCreateStepErrors, staffFieldErrors, validatePinOperatorForm, validateStaffCreateForm } from "./staff";

const actionSource = readFileSync(
  join(process.cwd(), "src/app/admin/staff/actions.ts"),
  "utf8"
);
const staffPageSource = readFileSync(
  join(process.cwd(), "src/app/admin/staff/page.tsx"),
  "utf8",
);
const staffLoadingSource = readFileSync(
  join(process.cwd(), "src/app/admin/staff/loading.tsx"),
  "utf8",
);
const staffCreateWizardSource = readFileSync(
  join(process.cwd(), "src/components/staff-create-wizard.tsx"),
  "utf8",
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
          branchId: "20000000-0000-4000-8000-000000000001",
          email: "NORTE@EXAMPLE.TEST",
          role: "MANAGER",
          temporaryPassword: "Temporary-1234",
          passwordConfirmation: "Temporary-1234"
        })
      )
    ).toEqual({
      ok: true,
      data: {
        branchId: "20000000-0000-4000-8000-000000000001",
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
        branchId: "",
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
        "Sucursal es obligatoria.",
        "El correo no es válido.",
        "El rol seleccionado no es válido.",
        "La contraseña temporal debe tener al menos 12 caracteres.",
        "La confirmación de contraseña no coincide."
      ]
    });
  });

  it("derives tenant and creator from the authenticated Admin context", () => {
    expect(actionSource).toContain('requireInternalArea("ADMIN", { writable: true })');
    expect(actionSource).toContain('rpc("provision_branch_employee"');
    expect(actionSource).toContain("created_by: context.userId");
    expect(actionSource).not.toContain('formData.get("tenant');
  });

  it("keeps Auth provisioning and cleanup server-only", () => {
    expect(actionSource).toContain("createSupabaseAdminClient");
    expect(actionSource).toContain("adminClient.auth.admin.createUser");
    expect(actionSource).toContain("adminClient.auth.admin.deleteUser");
  });

  it("organizes people by branch and opens focused workspaces", () => {
    expect(staffPageSource).toContain('className="staff-branch-nav"');
    expect(staffPageSource).toContain("selectedBranch");
    expect(staffPageSource).toContain("branchStaff");
    expect(staffPageSource).toContain("pinOperators");
    expect(staffPageSource).toContain("BranchWorkspaceDialog");
    expect(staffPageSource).toContain("Resumen");
    expect(staffPageSource).toContain("Sucursales");
    expect(staffPageSource).toContain("Seguridad");
    expect(staffPageSource).toContain("StaffCreateWizard");
    // Guided creation validates each step (DEC-0073).
    expect(staffCreateWizardSource).toContain("<WizardForm");
    expect(staffCreateWizardSource).toContain("staffCreateStepErrors(formData, 0)");
    expect(staffCreateWizardSource).toContain("pinOperatorStepErrors(formData, 1)");
    expect(staffPageSource).toContain("<AdminWorkspace");
    expect(staffPageSource).toContain('name="returnSection" value="security"');
    expect(staffPageSource).not.toContain("admin-management-grid");
  });

  it("provides route and in-control loading feedback", () => {
    expect(staffLoadingSource).toContain('aria-busy="true"');
    expect(staffLoadingSource).toContain("enterprise-skeleton");
    expect(staffPageSource).toContain("PendingLinkContent");
    expect(staffPageSource).toContain("SubmitButton");
  });
});

describe("staff provisioning compensation contract", () => {
  it("documents the cleanup dependency as an async operation", async () => {
    const cleanup = vi.fn().mockResolvedValue(true);
    await cleanup("new-auth-user");
    expect(cleanup).toHaveBeenCalledWith("new-auth-user");
  });
});

describe("guided staff creation (DEC-0073)", () => {
  it("maps validator messages to fields and filters them per step", () => {
    const data = form({ fullName: "", email: "bad", role: "EMPLOYEE", branchId: "", temporaryPassword: "short", passwordConfirmation: "x" });
    expect(staffFieldErrors(["Nombre es obligatorio.", "El correo no es válido."])).toEqual({ fullName: ["Nombre es obligatorio."], email: ["El correo no es válido."] });
    expect(Object.keys(staffCreateStepErrors(data, 0)).sort()).toEqual(["email", "fullName"]);
    expect(Object.keys(staffCreateStepErrors(data, 1))).toEqual(["branchId"]);
    expect(Object.keys(staffCreateStepErrors(data, 2)).sort()).toEqual(["passwordConfirmation", "temporaryPassword"]);
  });

  it("requires a name and exactly six PIN digits for PIN operators", () => {
    expect(validatePinOperatorForm(form({ fullName: "Ana", pin: "123456" }))).toEqual({});
    expect(Object.keys(validatePinOperatorForm(form({ fullName: " ", pin: "12a456" }))).sort()).toEqual(["fullName", "pin"]);
  });
});
