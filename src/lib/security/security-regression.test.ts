import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adminClient = readFileSync(new URL("../supabase/admin.ts", import.meta.url), "utf8");
const browserClient = readFileSync(new URL("../supabase/browser.ts", import.meta.url), "utf8");
const exportRoute = readFileSync(new URL("../../app/api/admin/exports/route.ts", import.meta.url), "utf8");
const envExample = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");

describe("security regression boundaries", () => {
  it("keeps service role access server-only and secrets out of the browser", () => {
    expect(adminClient).toContain('import "server-only"');
    expect(browserClient).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(envExample).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY=\S+/);
  });

  it("keeps export tenant scope server-derived", () => {
    expect(exportRoute).toContain('requireInternalArea("ADMIN")');
    expect(exportRoute).not.toContain("tenant_id = url.searchParams");
    expect(exportRoute).not.toContain("tenantId = url.searchParams");
  });
});
