import { describe, expect, it } from "vitest";
import { validatePublicCustomerRegistration } from "./registration";

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("validatePublicCustomerRegistration", () => {
  it("normalizes and validates a public registration", () => {
    expect(
      validatePublicCustomerRegistration(
        form({
          fullName: " Customer ",
          phone: "811 111 1111",
          email: "customer@example.test",
          birthDate: "1990-01-02",
          privacyConsent: "on"
        })
      )
    ).toEqual({
      ok: true,
      data: {
        fullName: "Customer",
        phone: "+528111111111",
        email: "customer@example.test",
        birthDate: "1990-01-02",
        privacyConsent: true
      }
    });
  });

  it("rejects missing consent and invalid fields", () => {
    const result = validatePublicCustomerRegistration(
      form({ fullName: "", phone: "bad", email: "bad" })
    );
    expect(result).toMatchObject({
      ok: false,
      errors: [
        "Nombre es obligatorio.",
        "El teléfono contiene caracteres inválidos.",
        "El correo no es válido.",
        "Debes aceptar el aviso de privacidad."
      ]
    });
  });
});
