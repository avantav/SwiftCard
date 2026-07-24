import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { importFileType, parseImportFile, validateImportFile, validateMappedRows } from "./imports";

const migration = readFileSync(new URL("../../../supabase/migrations/0024_customer_imports.sql", import.meta.url), "utf8");

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
});
