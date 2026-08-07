import { describe, expect, it } from "vitest";
import {
  colorContrastRatio,
  hexToAppleRgb,
  validateAppleWalletDesignForm,
} from "./design";

function validForm() {
  const form = new FormData();
  form.set("appleEnabled", "on");
  form.set("logoText", "Café Central");
  form.set("description", "Tarjeta de recompensas de Café Central");
  form.set("backgroundColor", "#17202A");
  form.set("foregroundColor", "#FFFFFF");
  form.set("labelColor", "#FFFFFF");
  form.set("logoImageUrl", "https://assets.example.com/logo.png");
  form.set("stripImageUrl", "https://assets.example.com/strip.jpg");
  return form;
}

describe("Apple Wallet tenant design", () => {
  it("normalizes a valid tenant design", () => {
    const result = validateAppleWalletDesignForm(validForm());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.appleEnabled).toBe(true);
    expect(result.data.backgroundColor).toBe("#17202A");
    expect(result.data.logoImageUrl).toBe("https://assets.example.com/logo.png");
  });

  it("rejects non-HTTPS assets and inaccessible color combinations", () => {
    const form = validForm();
    form.set("logoImageUrl", "http://localhost/logo.png");
    form.set("foregroundColor", "#17202A");
    const result = validateAppleWalletDesignForm(form);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("URL HTTPS");
    expect(result.errors.join(" ")).toContain("contraste");
  });

  it("converts stored hex colors to Apple's RGB format", () => {
    expect(hexToAppleRgb("#149C91")).toBe("rgb(20, 156, 145)");
    expect(colorContrastRatio("#000000", "#FFFFFF")).toBe(21);
  });
});
