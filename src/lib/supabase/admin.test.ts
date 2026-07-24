import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminClientSource = readFileSync(
  join(process.cwd(), "src/lib/supabase/admin.ts"),
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
});

