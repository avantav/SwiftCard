import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/0033_expose_app_api_schema.sql"
  ),
  "utf8"
);

const appRpcSources = [
  "src/app/admin/dashboard/page.tsx",
  "src/app/admin/program/actions.ts",
  "src/app/admin/staff/assignments.ts",
  "src/app/api/admin/exports/route.ts",
  "src/app/app/purchase/actions.ts",
  "src/app/app/redeem/actions.ts",
  "src/app/app/redeem/page.tsx",
  "src/app/app/register/actions.ts",
  "src/app/app/scan/actions.ts",
  "src/app/card/[cardToken]/page.tsx",
  "src/app/change-password/actions.ts",
  "src/app/register/[branchToken]/actions.ts",
  "src/app/superadmin/tenants/[tenantId]/administrator/new/actions.ts"
];

describe("app schema Data API boundary", () => {
  it("exposes app alongside the existing public API schemas", () => {
    expect(migration).toContain(
      "alter role authenticator set pgrst.db_schemas = ''public, app, graphql_public''"
    );
    expect(migration).toContain("notify pgrst, 'reload config'");
  });

  it("routes application RPC calls through the app schema", () => {
    for (const path of appRpcSources) {
      const source = readFileSync(join(process.cwd(), path), "utf8");
      expect(source, path).toMatch(/\.schema\("app"\)\s*\.rpc\(/);
    }
  });
});
