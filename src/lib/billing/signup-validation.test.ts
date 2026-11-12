import { describe, expect, it } from "vitest";
import { validateSignup } from "./signup-validation";

function form(overrides: Record<string, string | null> = {}) {
  const data = new FormData();
  const values: Record<string, string | null> = {
    plan: "crecimiento",
    interval: "YEAR",
    businessName: "  Café   Norte ",
    fullName: "Ana López",
    email: "Ana@Example.com",
    phone: "662 171 1274",
    password: "una-clave-segura",
    passwordConfirmation: "una-clave-segura",
    acceptTerms: "on",
    website: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) if (value !== null) data.set(key, value);
  return data;
}

describe("validateSignup", () => {
  it("normalizes a valid self-service signup", () => {
    const result = validateSignup(form());
    expect(result).toMatchObject({
      ok: true,
      data: { planCode: "crecimiento", interval: "YEAR", businessName: "Café Norte", email: "ana@example.com", password: "una-clave-segura" },
    });
  });

  it("rejects Empresarial and unknown plans because they are negotiated", () => {
    expect(validateSignup(form({ plan: "empresarial" })).ok).toBe(false);
    expect(validateSignup(form({ plan: "otro" })).ok).toBe(false);
  });

  it("requires a strong matching password and accepted terms", () => {
    const short = validateSignup(form({ password: "corta", passwordConfirmation: "corta" }));
    expect(short.ok ? [] : short.errors).toContain("La contraseña debe tener entre 12 y 72 caracteres.");
    const mismatch = validateSignup(form({ passwordConfirmation: "otra-clave-larga" }));
    expect(mismatch.ok ? [] : mismatch.errors).toContain("Las contraseñas no coinciden.");
    const terms = validateSignup(form({ acceptTerms: null }));
    expect(terms.ok ? [] : terms.errors).toContain("Debes aceptar los términos del servicio y el aviso de privacidad.");
  });

  it("treats the phone as optional and defaults the interval to monthly", () => {
    const result = validateSignup(form({ phone: "", interval: "weekly" }));
    expect(result).toMatchObject({ ok: true, data: { phone: null, interval: "MONTH" } });
  });

  it("flags bots that fill the hidden honeypot", () => {
    expect(validateSignup(form({ website: "https://spam.example" }))).toMatchObject({ ok: false, bot: true });
  });
});
