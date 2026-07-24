import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../supabase/migrations/0008_public_customer_registration.sql", import.meta.url), "utf8");

describe("public registration migration", () => {
  it("validates input, active tenant state, duplicates, and anonymous execution", () => {
    expect(migration).toContain("app.register_public_customer");
    expect(migration).toContain("'INVALID'");
    expect(migration).toContain("t.status = 'ACTIVE'");
    expect(migration).toContain("'DUPLICATE'");
    expect(migration).toContain("to anon");
  });
});
