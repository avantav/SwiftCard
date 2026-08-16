import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("PWA manifest", () => {
  it("declares an installable employee app with adaptive icons and shortcuts", () => {
    const value = manifest();
    expect(value.id).toBe("/app");
    expect(value.name).toBe("SwiftWallet Operación");
    expect(value.start_url).toBe("/app");
    expect(value.scope).toBe("/");
    expect(value.display).toBe("standalone");
    expect(value.theme_color).toBe("#149c91");
    expect(value.background_color).toBe("#f5f7f8");
    expect(value.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/icons/icon-192.png", sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ src: "/icons/icon-maskable-512.png", sizes: "512x512", purpose: "maskable" })
    ]));
    expect(value.shortcuts?.map((shortcut) => shortcut.url)).toEqual(["/app", "/app/scan"]);
  });

  it("ships valid PNG dimensions for Android and Apple launchers", () => {
    const icons = [
      ["../../../public/icons/icon-192.png", 192],
      ["../../../public/icons/icon-512.png", 512],
      ["../../../public/icons/icon-maskable-512.png", 512],
      ["../../../public/icons/apple-touch-icon.png", 180]
    ] as const;

    for (const [path, size] of icons) {
      const png = readFileSync(new URL(path, import.meta.url));
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }
  });
});
