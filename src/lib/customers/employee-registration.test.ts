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
      fullName: " Employee Customer ", phone: "811 222 2222", email: " customer@example.test ", privacyConsent: "on"
    }))).toEqual({
      ok: true,
      data: { fullName: "Employee Customer", phone: "+528112222222", email: "customer@example.test", birthDate: null, privacyConsent: true }
    });
  });

  it("rejects missing consent, invalid phone and missing email for new customers", () => {
    expect(validateEmployeeCustomerRegistration(form({ fullName: "Customer", phone: "bad" }))).toMatchObject({
      ok: false,
      errors: ["El teléfono contiene caracteres inválidos.", "Correo es obligatorio.", "Debes aceptar el aviso de privacidad."]
    });
  });

  it("keeps email optional when editing an existing customer", () => {
    expect(validateEmployeeCustomerRegistration(
      form({ fullName: "Customer", phone: "811 222 2222", privacyConsent: "on" }),
      { requireEmail: false }
    )).toMatchObject({ ok: true, data: { email: null } });
    expect(validateEmployeeCustomerRegistration(
      form({ fullName: "Customer", phone: "811 222 2222", email: "bad", privacyConsent: "on" }),
      { requireEmail: false }
    )).toMatchObject({ ok: false, errors: ["El correo no es válido."] });
  });
});
