import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../supabase/migrations/0011_public_web_card.sql", import.meta.url), "utf8");

describe("public web card projection", () => {
  it("only grants the projection to anon and filters active tokens", () => {
    expect(migration).toContain("app.get_public_web_card");
    expect(migration).toContain("cc.status = 'ACTIVE'");
    expect(migration).toContain("t.status = 'ACTIVE'");
    expect(migration).toContain("to anon");
    expect(migration).not.toContain("normalized_phone");
  });
});
