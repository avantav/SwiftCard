import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../supabase/migrations/0018_audit_logs.sql", import.meta.url), "utf8");

describe("audit logs", () => {
  it("is append-only and records sensitive entities through triggers", () => {
    expect(migration).toContain("create table public.audit_logs");
    expect(migration).toContain("audit_logs_no_update");
    expect(migration).toContain("audit_logs_no_delete");
    expect(migration).toContain("customers_audit_update");
    expect(migration).toContain("purchases_audit_insert");
    expect(migration).toContain("redemptions_audit_insert");
    expect(migration).toContain("revoke insert, update, delete");
  });
});
