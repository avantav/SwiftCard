import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CASA_GARMENDIA_IMPORT_PROFILE_CODE,
  isCasaGarmendiaTenantName,
  legacyStampsToLifetimePoints,
  normalizeCasaGarmendiaBirthDate,
  prepareCasaGarmendiaImport,
} from "./imports";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0053_casa_garmendia_import_profile.sql"),
  "utf8",
);
const actions = readFileSync(
  join(process.cwd(), "src/app/admin/imports/actions.ts"),
  "utf8",
);
const page = readFileSync(
  join(process.cwd(), "src/app/admin/imports/page.tsx"),
  "utf8",
);
const publicRegistration = readFileSync(
  join(process.cwd(), "src/app/register/[branchToken]/actions.ts"),
  "utf8",
);
const employeeScan = readFileSync(
  join(process.cwd(), "src/app/app/scan/page.tsx"),
  "utf8",
);

describe("Casa Garmendia customer import profile", () => {
  it("uses the greatest reached legacy milestone", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 12, 13, 14, 15].map(
      legacyStampsToLifetimePoints,
    )).toEqual([0, 0, 0, 100, 200, 200, 300, 400, 400, 500, 500, 650, 650, 860]);
    expect(legacyStampsToLifetimePoints(16)).toBeNull();
    expect(legacyStampsToLifetimePoints(1.5)).toBeNull();
  });

  it("recognizes the tenant spelling and normalizes spreadsheet dates", () => {
    expect(isCasaGarmendiaTenantName("Casa Garmendia")).toBe(true);
    expect(isCasaGarmendiaTenantName("Casa Germendia")).toBe(true);
    expect(isCasaGarmendiaTenantName("Otro negocio")).toBe(false);
    expect(normalizeCasaGarmendiaBirthDate("1999-3-5")).toBe("1999-03-05");
    expect(normalizeCasaGarmendiaBirthDate("5/3/1999")).toBe("1999-03-05");
    expect(normalizeCasaGarmendiaBirthDate("2023-02-30")).toBeNull();
    expect(normalizeCasaGarmendiaBirthDate("2999-01-01")).toBeNull();
  });

  it("auto-maps the exact legacy Excel columns and combines names", () => {
    const headers = ["Nombre", "Apellido", "Email", "Teléfono", "Fecha de Nacimiento", "Estampillas Actuales"];
    const result = prepareCasaGarmendiaImport(headers, [{
      Nombre: "Ana",
      Apellido: "López",
      Email: "ANA@EXAMPLE.COM",
      "Teléfono": "+526621234567",
      "Fecha de Nacimiento": "1990-2-3",
      "Estampillas Actuales": "6",
    }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.errors).toEqual([]);
    expect(result.preparedRows).toEqual([{
      source_row: 2,
      full_name: "Ana López",
      normalized_phone: "+526621234567",
      email: "ana@example.com",
      birth_date: "1990-02-03",
      legacy_stamps: "6",
    }]);
  });

  it("blocks malformed, duplicate and out-of-profile rows before confirmation", () => {
    const headers = ["Nombre", "Apellido", "Email", "Teléfono", "Fecha de Nacimiento", "Estampillas Actuales"];
    const result = prepareCasaGarmendiaImport(headers, [
      { Nombre: "Ana", Apellido: "López", Email: "ana@example.com", "Teléfono": "+526621234567", "Fecha de Nacimiento": "1990-02-03", "Estampillas Actuales": "3" },
      { Nombre: "Otra", Apellido: "Persona", Email: "mal", "Teléfono": "+526621234567", "Fecha de Nacimiento": "fecha", "Estampillas Actuales": "16" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preparedRows).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      row: 3,
      messages: [
        "El teléfono está repetido dentro del archivo.",
        "El correo no es válido.",
        "La fecha de nacimiento no es válida.",
        "Las estampillas deben ser un entero entre 0 y 15.",
      ],
    });
  });

  it("keeps confirmation atomic, tenant-derived, single-use and Admin-only", () => {
    expect(CASA_GARMENDIA_IMPORT_PROFILE_CODE).toBe("CASA_GARMENDIA_LEGACY_STAMPS_2026");
    expect(actions).toContain('requireInternalArea("ADMIN")');
    expect(actions).toContain('context.access.role !== "ADMIN"');
    expect(actions).toContain("prepared_rows: prepared.preparedRows");
    expect(page).toContain("Confirmar importación única");
    expect(migration).toContain("customer_imports_profile_confirmed_once_idx");
    expect(migration).toContain("staff.role = 'ADMIN'");
    expect(migration).toContain("for update of card, program");
    expect(migration).toContain("app.apply_lifetime_point_milestones");
    expect(migration).toContain("'Churro individual'");
    expect(migration).toContain("customer_import_id");
  });

  it("routes imported duplicate registration through terms and permits employee redelivery", () => {
    expect(migration).toContain("'IMPORTED_RECOVERY'");
    expect(migration).toContain("repeat_delivery_allowed boolean");
    expect(publicRegistration).toContain('result.result === "IMPORTED_RECOVERY"');
    expect(publicRegistration).toContain("customerCardClaimPath(result.card_token)");
    expect(employeeScan).toContain("delivery.repeat_delivery_allowed");
  });
});
