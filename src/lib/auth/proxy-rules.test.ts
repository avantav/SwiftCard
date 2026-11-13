import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { config } from "../../proxy";
import { hasAuthCookie, isProtectedPath } from "./proxy-rules";

const root = new URL("../../../", import.meta.url);

/** Same semantics Next.js uses: the matcher must match the whole pathname. */
function matched(pathname: string) {
  return config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(pathname));
}

describe("auth proxy", () => {
  it("lives next to src/app so Next.js actually runs it", () => {
    expect(existsSync(new URL("src/proxy.ts", root))).toBe(true);
    expect(existsSync(new URL("middleware.ts", root))).toBe(false);
    expect(existsSync(new URL("proxy.ts", root))).toBe(false);
  });

  it("protects staff areas only", () => {
    for (const path of ["/admin", "/admin/customers", "/app/scan", "/superadmin", "/change-password"]) {
      expect(isProtectedPath(path)).toBe(true);
    }
    for (const path of ["/", "/login", "/register/abc", "/card/token", "/administrator", "/apple", "/terminos"]) {
      expect(isProtectedPath(path)).toBe(false);
    }
  });

  it("detects whole and chunked Supabase auth cookies", () => {
    expect(hasAuthCookie(["swiftwallet-auth"])).toBe(true);
    expect(hasAuthCookie(["other", "swiftwallet-auth.0"])).toBe(true);
    expect(hasAuthCookie(["swiftwallet-authx", "sb-access-token"])).toBe(false);
    expect(hasAuthCookie([])).toBe(false);
  });

  it("runs on pages and staff APIs but skips assets and self-authenticated APIs", () => {
    for (const path of ["/", "/admin", "/app/scan", "/login", "/register/token", "/api/admin/exports"]) {
      expect(matched(path)).toBe(true);
    }
    for (const path of [
      "/_next/static/chunks/main.js",
      "/icons/icon-192.png",
      "/sw.js",
      "/manifest.webmanifest",
      "/robots.txt",
      "/api/stripe/webhook",
      "/api/wallet/apple/v1/devices/abc/registrations/pass.id",
      "/api/internal/wallet/apple/process-updates",
      "/api/health"
    ]) {
      expect(matched(path)).toBe(false);
    }
  });
});
