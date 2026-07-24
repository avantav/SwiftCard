import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0001_initial_auth_tenancy.sql"),
  "utf8"
);

describe("initial auth tenancy migration", () => {
  it("creates the phase 1 tenancy tables", () => {
    for (const table of [
      "public.tenants",
      "public.branches",
      "public.staff_profiles",
      "public.staff_branch_assignments"
    ]) {
      expect(migration).toContain(`create table ${table}`);
    }
  });

  it("enables and forces RLS on all phase 1 tables", () => {
    for (const table of [
      "public.tenants",
      "public.branches",
      "public.staff_profiles",
      "public.staff_branch_assignments"
    ]) {
      expect(migration).toContain(`alter table ${table} enable row level security`);
      expect(migration).toContain(`alter table ${table} force row level security`);
    }
  });

  it("keeps tenant and branch authorization behind database helpers", () => {
    for (const helper of [
      "app.current_staff_tenant_id",
      "app.current_staff_can_access_tenant",
      "app.current_staff_can_manage_tenant",
      "app.current_staff_can_access_branch",
      "app.is_superadmin"
    ]) {
      expect(migration).toContain(`function ${helper}`);
    }
  });

  it("defines positive and negative isolation primitives", () => {
    expect(migration).toContain("staff_profiles_superadmin_has_no_tenant");
    expect(migration).toContain("staff_branch_assignments_enforce_tenant");
    expect(migration).toContain("staff_tenant_id is distinct from new.tenant_id");
    expect(migration).toContain("branch_tenant_id is distinct from new.tenant_id");
    expect(migration).toContain("role <> 'SUPERADMIN'");
  });
});

