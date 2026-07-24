import { describe, expect, it } from "vitest";
import { validateTenantCreateForm } from "./tenants";
import { readFileSync } from "node:fs";

const suspensionMigration = readFileSync(new URL("../../../supabase/migrations/0027_tenant_suspension.sql", import.meta.url), "utf8");

function form(values: Record<string, string>) {
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    formData.set(key, value);
  });

  return formData;
}

describe("validateTenantCreateForm", () => {
  it("restricts tenant status changes to Superadmin and audits transitions", () => {
    expect(suspensionMigration).toContain("create or replace function public.set_tenant_status");
    expect(suspensionMigration).toContain("app.is_superadmin()");
    expect(suspensionMigration).toContain("TENANT_SUSPENDED");
    expect(suspensionMigration).toContain("TENANT_REACTIVATED");
    expect(suspensionMigration).toContain("revoke all on function");
  });
  it("normalizes valid tenant input", () => {
    const result = validateTenantCreateForm(
      form({
        name: "  Cafe Centro  ",
        contactEmail: "admin@example.test",
        currencyCode: "mxn",
        timezone: "America/Mazatlan",
        brandingMode: "WHITE_LABEL",
        primaryColor: "#abc123",
        secondaryColor: "#17202a"
      })
    );

    expect(result).toEqual({
      ok: true,
      data: {
        name: "Cafe Centro",
        contactName: null,
        contactEmail: "admin@example.test",
        contactPhone: null,
        status: "ACTIVE",
        currencyCode: "MXN",
        timezone: "America/Mazatlan",
        brandingMode: "WHITE_LABEL",
        primaryColor: "#ABC123",
        secondaryColor: "#17202A"
      }
    });
  });

  it("rejects missing required fields", () => {
    const result = validateTenantCreateForm(form({}));

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      errors: [
        "Nombre es obligatorio.",
        "Zona horaria es obligatorio.",
        "Moneda es obligatorio."
      ]
    });
  });

  it("rejects invalid contact email and currency", () => {
    const result = validateTenantCreateForm(
      form({
        name: "Tenant",
        contactEmail: "invalid",
        currencyCode: "mx",
        timezone: "America/Mazatlan"
      })
    );

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      errors: [
        "La moneda debe usar código ISO de 3 letras.",
        "El correo de contacto no es válido."
      ]
    });
  });
});
