import { describe, expect, it } from "vitest";
import {
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
  form.set("notificationIconUrl", "https://assets.example.com/notification.png");
  form.set("stampIconUrl", "https://assets.example.com/stamp.png");
  form.set("logoScalePercent", "85");
  form.set("logoMarginXPercent", "4");
  form.set("logoMarginYPercent", "6");
  form.set("stripScalePercent", "115");
  form.set("stripMarginXPercent", "8");
  form.set("stripMarginYPercent", "10");
  form.set("stripDimmingEnabled", "on");
  form.set("stripStampsEnabled", "on");
  form.set("stampEmptySlotsEnabled", "on");
  form.set("stampRowCounts", "3,3,4");
  form.set("stampPositionXPercent", "35");
  form.set("stampPositionYPercent", "62");
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
    expect(result.data.logoScalePercent).toBe(85);
    expect(result.data.stripMarginYPercent).toBe(10);
    expect(result.data.stripDimmingEnabled).toBe(true);
    expect(result.data.stripStampsEnabled).toBe(true);
    expect(result.data.stampIconUrl).toBe("https://assets.example.com/stamp.png");
    expect(result.data.stampEmptySlotsEnabled).toBe(true);
    expect(result.data.stampRowCounts).toEqual([3, 3, 4]);
    expect(result.data.stampPositionXPercent).toBe(35);
    expect(result.data.stampPositionYPercent).toBe(62);
    expect(result.data.notificationIconUrl).toBe(
      "https://assets.example.com/notification.png",
    );
  });

  it("rejects stamp rows and drag positions outside Apple-safe bounds", () => {
    const form = validForm();
    form.set("stampRowCounts", "9,8,8");
    form.set("stampPositionXPercent", "101");
    const result = validateAppleWalletDesignForm(form);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toContain("distribución de sellos");
      expect(result.errors.join(" ")).toContain("posición horizontal");
    }
  });

  it("rejects image scale and margin values outside their safe ranges", () => {
    const form = validForm();
    form.set("logoScalePercent", "101");
    form.set("stripMarginXPercent", "21");
    const result = validateAppleWalletDesignForm(form);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("El tamaño del logo debe estar entre 50 y 100.");
      expect(result.errors).toContain("El margen horizontal de la imagen principal debe estar entre 0 y 20.");
    }
  });

  it("preserves the original image brightness when dimming is unchecked", () => {
    const form = validForm();
    form.delete("stripDimmingEnabled");
    const result = validateAppleWalletDesignForm(form);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.stripDimmingEnabled).toBe(false);
  });

  it("hides graphical stamps when their option is unchecked", () => {
    const form = validForm();
    form.delete("stripStampsEnabled");
    const result = validateAppleWalletDesignForm(form);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.stripStampsEnabled).toBe(false);
  });

  it("accepts an empty optional card title", () => {
    const form = validForm();
    form.set("logoText", "");
    const result = validateAppleWalletDesignForm(form);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.logoText).toBe("");
  });

  it("rejects non-HTTPS assets", () => {
    const form = validForm();
    form.set("logoImageUrl", "http://localhost/logo.png");
    form.set("notificationIconUrl", "http://localhost/notification.png");
    const result = validateAppleWalletDesignForm(form);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("URL HTTPS");
  });

  it("accepts valid colors without enforcing a contrast ratio", () => {
    const form = validForm();
    form.set("foregroundColor", "#17202A");
    form.set("labelColor", "#17202A");
    expect(validateAppleWalletDesignForm(form).ok).toBe(true);
  });

  it("converts stored hex colors to Apple's RGB format", () => {
    expect(hexToAppleRgb("#149C91")).toBe("rgb(20, 156, 145)");
  });
});
