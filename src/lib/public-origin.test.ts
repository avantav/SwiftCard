import { describe, expect, it } from "vitest";
import { publicRegistrationUrl, resolvePublicOrigin } from "./public-origin";

describe("public application origin", () => {
  it("accepts production HTTPS and local development origins", () => {
    expect(resolvePublicOrigin("https://rewards.example.com/")).toBe(
      "https://rewards.example.com",
    );
    expect(resolvePublicOrigin("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });

  it("rejects insecure remote origins and embedded credentials or paths", () => {
    expect(resolvePublicOrigin("http://rewards.example.com")).toBeNull();
    expect(resolvePublicOrigin("https://user:pass@example.com")).toBeNull();
    expect(resolvePublicOrigin("https://example.com/app")).toBeNull();
  });

  it("builds an encoded branch registration URL", () => {
    expect(
      publicRegistrationUrl("https://rewards.example.com", "branch/token"),
    ).toBe("https://rewards.example.com/register/branch%2Ftoken");
  });
});
