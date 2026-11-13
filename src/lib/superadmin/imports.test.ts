import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { importFileType, parseImportFile, validateImportFile, validateMappedRows } from "./imports";
import { importCardLabel } from "./import-cards";

const migration = readFileSync(new URL("../../../supabase/migrations/0024_customer_imports.sql", import.meta.url), "utf8");
const confirmationMigration = readFileSync(new URL("../../../supabase/migrations/0026_customer_import_confirmation.sql", import.meta.url), "utf8");

describe("customer imports", () => {
  it("validates supported upload types and size", () => {
    expect(validateImportFile(new File(["name,phone"], "customers.csv", { type: "text/csv" })).ok).toBe(true);
    expect(validateImportFile(new File(["data"], "customers.txt", { type: "text/plain" })).ok).toBe(false);
    expect(importFileType(new File(["data"], "customers.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))).toContain("spreadsheetml");
  });

  it("keeps import history restricted to Superadmin", () => {
    expect(migration).toContain("create table public.customer_imports");
    expect(migration).toContain("create policy customer_imports_superadmin_all");
    expect(migration).toContain("using (app.is_superadmin())");
    expect(migration).toContain("file_size_bytes");
    expect(migration).toContain("raw_rows jsonb");
  });

  it("parses CSV rows into normalized records", async () => {
    const file = new File(["Nombre,Teléfono\nAna,+5215512345678\nLuis,+5215587654321"], "customers.csv", { type: "text/csv" });
    const parsed = await parseImportFile(file);
    expect(parsed.headers).toEqual(["Nombre", "Teléfono"]);
    expect(parsed.rows).toEqual([
      { Nombre: "Ana", "Teléfono": "+5215512345678" },
      { Nombre: "Luis", "Teléfono": "+5215587654321" }
    ]);
  });

  it("validates mapped required and optional fields without mutating rows", () => {
    const errors = validateMappedRows([{ name: "Ana", phone: "123", email: "bad" }, { name: "", phone: "+5215512345678", email: "ana@example.com" }], { fullName: "name", phone: "phone", email: "email" });
    expect(errors).toEqual([{ row: 2, messages: ["El teléfono debe tener entre 8 y 15 dígitos internacionales.", "El correo no es válido."] }, { row: 3, messages: ["El nombre es obligatorio."] }]);
  });

  it("keeps confirmation atomic and Superadmin-only", () => {
    expect(confirmationMigration).toContain("create or replace function public.confirm_customer_import");
    expect(confirmationMigration).toContain("for update");
    expect(confirmationMigration).toContain("customer_cards");
    expect(confirmationMigration).toContain("stamp_ledger");
    expect(confirmationMigration).toContain("revoke all on function");
  });

  it("imports into a card and converts stamps by program type (DEC-0065)", () => {
    const cardScoped = readFileSync(new URL("../../../supabase/migrations/0073_card_scoped_customer_import.sql", import.meta.url), "utf8");
    expect(cardScoped).toContain("drop function if exists public.confirm_customer_import(uuid, uuid, jsonb)");
    expect(cardScoped).toContain("target_loyalty_card_id uuid");
    expect(cardScoped).toContain("import_stamp_to_point_multiplier * 10");
    expect(cardScoped).toContain("app.apply_lifetime_point_milestones(");
    expect(cardScoped).toContain("app.apply_reward_tiers(");
    expect(cardScoped).toContain("'CUSTOMERS_IMPORTED'");
  });

  it("limits initial stamps to six digits", () => {
    const errors = validateMappedRows([{ name: "Ana", phone: "+5215512345678", stamps: "1000000" }], { fullName: "name", phone: "phone", initialStamps: "stamps" });
    expect(errors).toEqual([{ row: 2, messages: ["Los sellos iniciales deben ser un entero entre 0 y 999999."] }]);
  });

  it("explains the conversion of each card", () => {
    expect(importCardLabel("Club", "STAMPS_PER_PURCHASE", 1)).toBe("Club · sellos");
    expect(importCardLabel("Club", "LIFETIME_POINTS", 50)).toBe("Club · puntos acumulados (1 sello = 50 puntos)");
    expect(importCardLabel("Club", "LIFETIME_POINTS", null)).toBe("Club · puntos acumulados (1 sello = 1 punto)");
  });
});
