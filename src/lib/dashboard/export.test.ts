import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync(new URL("../../../src/app/api/admin/exports/route.ts", import.meta.url), "utf8");

describe("dashboard exports", () => {
  it("keeps export types allowlisted and server-side", () => {
    expect(route).toContain("requireInternalArea(\"ADMIN\")");
    expect(route).toContain("exportTypes");
    expect(route).toContain("Content-Disposition");
    expect(route).not.toContain("tenant_id = url.searchParams");
  });
});
