import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { importFileType, validateImportFile } from "./imports";

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
});
