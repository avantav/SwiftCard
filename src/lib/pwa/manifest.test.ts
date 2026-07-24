import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("PWA manifest", () => {
  it("declares an installable employee app without secrets", () => {
    const value = manifest();
    expect(value.name).toBe("SwiftWallet");
    expect(value.start_url).toBe("/app");
    expect(value.display).toBe("standalone");
    expect(value.theme_color).toBe("#149c91");
    expect(value.icons?.[0]?.src).toBe("/icon.svg");
  });
});
