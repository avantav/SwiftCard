import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adminClient = readFileSync(new URL("../supabase/admin.ts", import.meta.url), "utf8");
const browserClient = readFileSync(new URL("../supabase/browser.ts", import.meta.url), "utf8");
const exportRoute = readFileSync(new URL("../../app/api/admin/exports/route.ts", import.meta.url), "utf8");
const envExample = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");
const remoteMigrationRunner = readFileSync(
  new URL("../../../scripts/apply-remote-migrations.mjs", import.meta.url),
  "utf8",
);

describe("security regression boundaries", () => {
  it("keeps service role access server-only and secrets out of the browser", () => {
    expect(adminClient).toContain('import "server-only"');
    expect(browserClient).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(browserClient).not.toContain("SUPABASE_SECRET_KEY");
    expect(envExample).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY=\S+/);
    expect(envExample).not.toMatch(/SUPABASE_SECRET_KEY=\S+/);
  });

  it("keeps export tenant scope server-derived", () => {
    expect(exportRoute).toContain('requireInternalArea("ADMIN")');
    expect(exportRoute).not.toContain("tenant_id = url.searchParams");
    expect(exportRoute).not.toContain("tenantId = url.searchParams");
  });

  it("does not rethrow process errors that include database connection arguments", () => {
    expect(remoteMigrationRunner).not.toContain("throw result.error");
    expect(remoteMigrationRunner).toContain("Unable to start psql");
  });
});
