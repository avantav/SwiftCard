import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./public-registration-context.ts", import.meta.url),
  "utf8",
);

describe("public registration context boundary", () => {
  it("derives a minimal active context from the opaque branch token", () => {
    expect(source).toContain('import "server-only"');
    expect(source).toContain("createSupabaseAdminClient");
    expect(source).toContain('.eq("public_registration_token", branchToken)');
    expect(source).toContain('branch.status !== "ACTIVE"');
    expect(source).toContain('tenant.status !== "ACTIVE"');
    expect(source).toContain('.select("id,tenant_id,name,status")');
    expect(source).toContain('.select("name,status")');
    expect(source).toContain('.from("loyalty_card_branches")');
    expect(source).toContain('.from("loyalty_cards")');
    expect(source).toContain('.eq("status", "PUBLISHED")');
    expect(source).not.toContain("normalized_phone");
  });
});
