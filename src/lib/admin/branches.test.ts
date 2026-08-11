import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  describeBranchPersistenceError,
  validateBranchCreateForm,
  validateBranchUpdateForm,
} from "./branches";

const branchAction = readFileSync(
  join(process.cwd(), "src/app/admin/branches/actions.ts"),
  "utf8"
);
const branchForm = readFileSync(
  join(process.cwd(), "src/components/branch-create-form.tsx"),
  "utf8",
);
const branchEditForm = readFileSync(
  join(process.cwd(), "src/components/branch-edit-form.tsx"),
  "utf8",
);

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("validateBranchCreateForm", () => {
  it("normalizes a valid branch", () => {
    expect(
      validateBranchCreateForm(
        form({
          name: "  Centro  ",
          address: "Av. Principal 10",
          latitude: "23.2494",
          longitude: "-106.4111",
          geofenceRadiusMeters: "150",
          proximityEnabled: "on",
          employeeAccessMode: "INDIVIDUAL_CREDENTIALS"
        })
      )
    ).toEqual({
      ok: true,
      data: {
        name: "Centro",
        address: "Av. Principal 10",
        latitude: 23.2494,
        longitude: -106.4111,
        geofenceRadiusMeters: 150,
        proximityEnabled: true,
        employeeAccessMode: "INDIVIDUAL_CREDENTIALS",
        sharedEmail: null,
        sharedPassword: null
      }
    });
  });

  it("requires valid shared credentials for PIN access", () => {
    expect(validateBranchCreateForm(form({
      name: "Terraza",
      geofenceRadiusMeters: "100",
      employeeAccessMode: "SHARED_ACCOUNT_PIN",
      sharedEmail: "operacion@example.test",
      sharedPassword: "Shared-access-123",
      sharedPasswordConfirmation: "Shared-access-123"
    }))).toMatchObject({
      ok: true,
      data: {
        employeeAccessMode: "SHARED_ACCOUNT_PIN",
        sharedEmail: "operacion@example.test"
      }
    });
  });

  it("allows omitted coordinates", () => {
    expect(
      validateBranchCreateForm(
        form({ name: "Norte", geofenceRadiusMeters: "100" })
      )
    ).toMatchObject({
      ok: true,
      data: { latitude: null, longitude: null }
    });
  });

  it("rejects incomplete coordinates and invalid radius", () => {
    expect(
      validateBranchCreateForm(
        form({
          name: "",
          latitude: "91",
          geofenceRadiusMeters: "0"
        })
      )
    ).toMatchObject({
      ok: false,
      errors: [
        "El nombre de la sucursal es obligatorio.",
        "Captura la longitud junto con la latitud.",
        "La latitud debe ser un número entre -90 y 90.",
        "El radio debe ser un número entero entre 1 y 100000 metros."
      ],
      fieldErrors: {
        name: ["El nombre de la sucursal es obligatorio."],
        longitude: ["Captura la longitud junto con la latitud."],
        latitude: ["La latitud debe ser un número entre -90 y 90."],
        geofenceRadiusMeters: [
          "El radio debe ser un número entero entre 1 y 100000 metros.",
        ],
      },
      values: {
        latitude: "91",
        geofenceRadiusMeters: "0",
      },
    });
  });

  it("reports every invalid shared-account field without retaining passwords", () => {
    const result = validateBranchCreateForm(
      form({
        name: "Sucursal válida",
        address: "x".repeat(301),
        geofenceRadiusMeters: "100.5",
        employeeAccessMode: "SHARED_ACCOUNT_PIN",
        sharedEmail: "correo-invalido",
        sharedPassword: "short",
        sharedPasswordConfirmation: "different",
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        address: ["La dirección no puede exceder 300 caracteres."],
        geofenceRadiusMeters: [
          "El radio debe ser un número entero entre 1 y 100000 metros.",
        ],
        sharedEmail: ["Captura un correo compartido válido."],
        sharedPassword: [
          "La contraseña compartida debe tener entre 12 y 72 caracteres.",
        ],
        sharedPasswordConfirmation: [
          "La confirmación no coincide con la contraseña compartida.",
        ],
      },
    });
    if (!result.ok) {
      expect(result.values).not.toHaveProperty("sharedPassword");
      expect(result.values).not.toHaveProperty("sharedPasswordConfirmation");
    }
  });

  it("translates database rejections into safe actionable explanations", () => {
    expect(
      describeBranchPersistenceError({
        code: "PGRST204",
        message: "employee_access_mode was not found",
      }),
    ).toMatchObject({
      formError: expect.stringContaining("migración 0035"),
      fieldErrors: { employeeAccessMode: expect.any(Array) },
    });
    expect(
      describeBranchPersistenceError({
        code: "42501",
        message: "new row violates row-level security policy",
      }).formError,
    ).toContain("Admin general");
    expect(
      describeBranchPersistenceError({ code: "NETWORK_FAILURE" }).formError,
    ).toContain("NETWORK_FAILURE");
  });

  it("derives tenant authority from the authenticated context", () => {
    expect(branchAction).toContain("tenant_id: context.tenantId");
    expect(branchAction).toContain("const branchId = randomUUID()");
    expect(branchAction).toContain('context.access.role !== "ADMIN"');
    expect(branchAction).toContain("describeBranchPersistenceError");
    expect(branchAction).toContain("logCreateFailure");
    expect(branchAction).not.toContain('.select("id").single()');
    expect(branchAction).not.toContain('formData.get("tenant');
  });

  it("renders an accessible error summary and field-level validation", () => {
    expect(branchForm).toContain("useActionState");
    expect(branchForm).toContain('role="alert"');
    expect(branchForm).toContain("aria-invalid");
    expect(branchForm).toContain("field-error-message");
    expect(branchForm).toContain("summaryRef.current?.focus()");
  });
});

describe("validateBranchUpdateForm", () => {
  it("normalizes every editable branch field", () => {
    expect(
      validateBranchUpdateForm(
        form({
          branchId: "20000000-0000-4000-8000-000000000001",
          name: "  Malecón  ",
          address: "Av. del Mar 100",
          latitude: "23.2105",
          longitude: "-106.4231",
          geofenceRadiusMeters: "250",
          proximityEnabled: "on",
          proximityMessage: "  Estás cerca de Malecón.  ",
          status: "ACTIVE",
        }),
      ),
    ).toEqual({
      ok: true,
      data: {
        branchId: "20000000-0000-4000-8000-000000000001",
        name: "Malecón",
        address: "Av. del Mar 100",
        latitude: 23.2105,
        longitude: -106.4231,
        geofenceRadiusMeters: 250,
        proximityEnabled: true,
        proximityMessage: "Estás cerca de Malecón.",
        status: "ACTIVE",
      },
    });
  });

  it("reports invalid identifiers, fields, proximity copy, and status together", () => {
    expect(
      validateBranchUpdateForm(
        form({
          branchId: "otra-sucursal",
          name: "A",
          latitude: "23",
          geofenceRadiusMeters: "1.5",
          proximityMessage: "x".repeat(501),
          status: "DELETED",
        }),
      ),
    ).toMatchObject({
      ok: false,
      fieldErrors: {
        branchId: ["No se pudo identificar la sucursal que deseas editar."],
        name: ["El nombre debe tener al menos 2 caracteres."],
        longitude: ["Captura la longitud junto con la latitud."],
        geofenceRadiusMeters: [
          "El radio debe ser un número entero entre 1 y 100000 metros.",
        ],
        proximityMessage: [
          "El mensaje de proximidad no puede exceder 500 caracteres.",
        ],
        status: ["Selecciona un estado válido para la sucursal."],
      },
    });
  });

  it("keeps update authority server-side and tenant-scoped", () => {
    expect(branchAction).toContain("validateBranchUpdateForm");
    expect(branchAction).toContain('.eq("id", validation.data.branchId)');
    expect(branchAction).toContain('.eq("tenant_id", context.tenantId)');
    expect(branchAction).toContain('context.access.role !== "ADMIN"');
    expect(branchAction).not.toContain('formData.get("tenantId")');
  });

  it("renders accessible errors and confirms branch deactivation", () => {
    expect(branchEditForm).toContain("useActionState");
    expect(branchEditForm).toContain('role="alert"');
    expect(branchEditForm).toContain("aria-invalid");
    expect(branchEditForm).toContain("summaryRef.current?.focus()");
    expect(branchEditForm).toContain("Al desactivar la sucursal");
  });

  it("describes update persistence failures without leaking raw details", () => {
    expect(
      describeBranchPersistenceError(
        { code: "42501", message: "row-level security" },
        "update",
      ).formError,
    ).toContain("editar esta sucursal");
    expect(
      describeBranchPersistenceError({ code: "DB_FAILURE" }, "update")
        .formError,
    ).toContain("actualización");
  });
});
