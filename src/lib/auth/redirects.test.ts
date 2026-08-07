import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "./redirects";

describe("getSafeRedirectPath", () => {
  it("allows same-origin relative paths", () => {
    expect(getSafeRedirectPath("/admin")).toBe("/admin");
    expect(getSafeRedirectPath("/app?branch=abc#scan")).toBe("/app?branch=abc#scan");
  });

  it("rejects external redirects", () => {
    expect(getSafeRedirectPath("https://example.com/app")).toBe("/app");
    expect(getSafeRedirectPath("//example.com/app")).toBe("/app");
  });

  it("uses the provided fallback for invalid input", () => {
    expect(getSafeRedirectPath(null, "/login")).toBe("/login");
    expect(getSafeRedirectPath("", "/login")).toBe("/login");
  });
});

