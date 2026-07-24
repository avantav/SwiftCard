import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0001_initial_auth_tenancy.sql"),
  "utf8"
);
const rlsVerification = readFileSync(
  join(process.cwd(), "supabase/tests/0001_initial_auth_tenancy_rls.sql"),
  "utf8"
);
const firstAdministratorMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/0002_first_tenant_administrator.sql"
  ),
  "utf8"
);
const administratorPasswordResetMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/0003_tenant_administrator_password_reset.sql"
  ),
  "utf8"
);
const requiredPasswordChangeMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/0004_complete_required_password_change.sql"
  ),
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

  it("has repeatable RLS checks for all phase 1 access boundaries", () => {
    for (const scenario of [
      "Admin A expected 1 tenant",
      "Admin A updated Tenant B",
      "Admin A inserted a branch into Tenant B",
      "Cross-tenant staff assignment was accepted",
      "Manager A expected 1 assigned branch",
      "Employee A expected 1 assigned branch",
      "Inactive staff expected 0 branches",
      "Password-reset-required staff expected no operational access",
      "Suspended tenant admin expected no access",
      "Superadmin expected 3 tenants and 4 branches"
    ]) {
      expect(rlsVerification).toContain(scenario);
    }
  });

  it("creates the first Administrator profile atomically and server-only", () => {
    expect(firstAdministratorMigration).toContain(
      "function app.create_first_tenant_administrator"
    );
    expect(firstAdministratorMigration).toContain("pg_advisory_xact_lock");
    expect(firstAdministratorMigration).toContain(
      "'PASSWORD_RESET_REQUIRED'"
    );
    expect(firstAdministratorMigration).toContain(
      "from public, anon, authenticated"
    );
    expect(firstAdministratorMigration).toContain("to service_role");
  });

  it("marks only the selected tenant Administrator for password reset", () => {
    expect(administratorPasswordResetMigration).toContain(
      "function app.mark_tenant_administrator_password_reset"
    );
    expect(administratorPasswordResetMigration).toContain(
      "sp.tenant_id = target_tenant_id"
    );
    expect(administratorPasswordResetMigration).toContain(
      "sp.role = 'ADMIN'"
    );
    expect(administratorPasswordResetMigration).toContain(
      "sp.status in ('ACTIVE', 'PASSWORD_RESET_REQUIRED')"
    );
    expect(administratorPasswordResetMigration).toContain(
      "status = 'PASSWORD_RESET_REQUIRED'"
    );
    expect(administratorPasswordResetMigration).toContain(
      "from public, anon, authenticated"
    );
  });

  it("keeps password-change completion behind the service role boundary", () => {
    expect(requiredPasswordChangeMigration).toContain(
      "function app.complete_required_password_change"
    );
    expect(requiredPasswordChangeMigration).toContain(
      "sp.status = 'PASSWORD_RESET_REQUIRED'"
    );
    expect(requiredPasswordChangeMigration).toContain(
      "from public, anon, authenticated"
    );
    expect(requiredPasswordChangeMigration).toContain("to service_role");
    expect(requiredPasswordChangeMigration).toContain(
      "last_password_change_at = now()"
    );
  });
});
