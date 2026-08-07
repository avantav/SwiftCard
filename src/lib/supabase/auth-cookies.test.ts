import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  swiftWalletAuthCookieEncoding,
  swiftWalletAuthCookieOptions,
} from "./auth-cookies";

const clientSources = ["browser.ts", "server.ts", "middleware.ts"].map((file) =>
  readFileSync(join(process.cwd(), "src/lib/supabase", file), "utf8"),
);

describe("Supabase auth cookie boundary", () => {
  it("uses one application-specific cookie name", () => {
    expect(swiftWalletAuthCookieOptions).toEqual({ name: "swiftwallet-auth" });

    for (const source of clientSources) {
      expect(source).toContain("cookieOptions: swiftWalletAuthCookieOptions");
    }
  });

  it("stores only tokens in cookies across browser and server clients", () => {
    expect(swiftWalletAuthCookieEncoding).toBe("tokens-only");

    for (const source of clientSources) {
      expect(source).toContain("encode: swiftWalletAuthCookieEncoding");
    }
  });
});
