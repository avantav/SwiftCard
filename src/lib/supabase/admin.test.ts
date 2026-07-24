import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminClientSource = readFileSync(
  join(process.cwd(), "src/lib/supabase/admin.ts"),
  "utf8"
);
const firstAdministratorActionSource = readFileSync(
  join(
    process.cwd(),
    "src/app/superadmin/tenants/[tenantId]/administrator/new/actions.ts"
  ),
  "utf8"
);

describe("Supabase admin client boundary", () => {
  it("is marked server-only", () => {
    expect(adminClientSource).toContain('import "server-only"');
  });

  it("uses the service role key only inside the server-only module", () => {
    expect(adminClientSource).toContain("getServerSupabaseServiceRoleKey");
    expect(adminClientSource).toContain("persistSession: false");
  });

  it("provisions first Administrators through server-only Auth and RPC calls", () => {
    expect(firstAdministratorActionSource).toContain(
      "adminClient.auth.admin.createUser"
    );
    expect(firstAdministratorActionSource).toContain(
      '"create_first_tenant_administrator"'
    );
    expect(firstAdministratorActionSource).toContain(
      "adminClient.auth.admin.deleteUser"
    );
    expect(firstAdministratorActionSource).toContain("email_confirm: true");
  });
});
