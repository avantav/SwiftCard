import { describe, expect, it } from "vitest";
import { validateEmployeeCustomerRegistration } from "./employee-registration";

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("validateEmployeeCustomerRegistration", () => {
  it("normalizes an employee registration", () => {
    expect(validateEmployeeCustomerRegistration(form({
      fullName: " Employee Customer ", phone: "811 222 2222", privacyConsent: "on"
    }))).toEqual({
      ok: true,
      data: { fullName: "Employee Customer", phone: "+528112222222", email: null, birthDate: null, privacyConsent: true }
    });
  });

  it("rejects missing consent and invalid phone", () => {
    expect(validateEmployeeCustomerRegistration(form({ fullName: "Customer", phone: "bad" }))).toMatchObject({
      ok: false,
      errors: ["El teléfono contiene caracteres inválidos.", "Debes aceptar el aviso de privacidad."]
    });
  });
});
