import { describe, expect, it } from "vitest";
import {
  publicRegistrationUrl,
  resolvePublicOrigin,
  resolvePublicRequestOrigin
} from "./public-origin";

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

  it("prefers the configured public origin over an internal request URL", () => {
    const headers = new Headers({
      host: "localhost:3000",
      "x-forwarded-host": "wallet.example.com",
      "x-forwarded-proto": "https"
    });

    expect(
      resolvePublicRequestOrigin(
        "http://localhost:3000/support/start",
        headers,
        "https://configured.example.com",
      ),
    ).toBe("https://configured.example.com");
  });

  it("uses forwarded production host when no public origin is configured", () => {
    const headers = new Headers({
      host: "localhost:3000",
      "x-forwarded-host": "wallet.example.com",
      "x-forwarded-proto": "https"
    });

    expect(
      resolvePublicRequestOrigin(
        "http://localhost:3000/support/start",
        headers,
        null,
      ),
    ).toBe("https://wallet.example.com");
  });
});
