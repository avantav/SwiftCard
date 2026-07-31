import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatMinorUnitsForInput,
  getCurrencyFractionDigits,
  validateLoyaltyProgramForm,
} from "./program";

const action = readFileSync(
  join(process.cwd(), "src/app/admin/program/actions.ts"),
  "utf8",
);
const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/0032_loyalty_program_creation.sql",
  ),
  "utf8",
);

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("loyalty program Admin configuration", () => {
  it("normalizes a per-purchase MXN configuration to minor units", () => {
    expect(
      validateLoyaltyProgramForm(
        form({
          programId: "10000000-0000-0000-0000-000000000001",
          name: " Programa principal ",
          status: "ACTIVE",
          ruleType: "PER_PURCHASE",
          minimumPurchase: "100.50",
          stampsPerPurchase: "2",
          rewardStampGoal: "10",
          rewardName: " Bebida gratis ",
          rewardDescription: "Una bebida",
          rewardExpirationDays: "30",
        }),
        "MXN",
      ),
    ).toEqual({
      ok: true,
      data: {
        programId: "10000000-0000-0000-0000-000000000001",
        name: "Programa principal",
        status: "ACTIVE",
        ruleType: "PER_PURCHASE",
        minimumPurchaseMinor: 10050,
        stampsPerPurchase: 2,
        amountPerStampMinor: null,
        carryRemainder: false,
        rewardStampGoal: 10,
        rewardName: "Bebida gratis",
        rewardDescription: "Una bebida",
        rewardExpirationDays: 30,
      },
    });
  });

  it("normalizes a per-amount rule and remainder behavior", () => {
    expect(
      validateLoyaltyProgramForm(
        form({
          name: "Puntos",
          status: "PAUSED",
          ruleType: "PER_AMOUNT",
          amountPerStamp: "25.75",
          carryRemainder: "on",
          rewardStampGoal: "8",
          rewardName: "Premio",
          rewardDescription: "",
          rewardExpirationDays: "",
        }),
        "USD",
      ),
    ).toMatchObject({
      ok: true,
      data: {
        programId: null,
        status: "PAUSED",
        ruleType: "PER_AMOUNT",
        minimumPurchaseMinor: 0,
        stampsPerPurchase: 1,
        amountPerStampMinor: 2575,
        carryRemainder: true,
        rewardExpirationDays: null,
      },
    });
  });

  it("respects currency-specific decimal precision", () => {
    expect(getCurrencyFractionDigits("JPY")).toBe(0);
    expect(getCurrencyFractionDigits("KWD")).toBe(3);
    expect(formatMinorUnitsForInput(12345, "KWD")).toBe("12.345");

    expect(
      validateLoyaltyProgramForm(
        form({
          name: "Programa",
          status: "ACTIVE",
          ruleType: "PER_AMOUNT",
          amountPerStamp: "100.50",
          rewardStampGoal: "10",
          rewardName: "Premio",
        }),
        "JPY",
      ),
    ).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        "El monto por sello debe ser un importe válido con máximo 0 decimales.",
      ]),
    });
  });

  it("rejects invalid identifiers, values, and lengths", () => {
    expect(
      validateLoyaltyProgramForm(
        form({
          programId: "tenant-controlled",
          name: "",
          status: "DISABLED",
          ruleType: "PER_PURCHASE",
          minimumPurchase: "-1",
          stampsPerPurchase: "0",
          rewardStampGoal: "0",
          rewardName: "",
          rewardExpirationDays: "0",
        }),
        "MXN",
      ),
    ).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        "El identificador del programa no es válido.",
        "El estado del programa no es válido.",
        "El monto mínimo debe ser un importe válido con máximo 2 decimales.",
        "La cantidad de sellos por compra debe ser un entero entre 1 y 1000000.",
      ]),
    });
  });

  it("derives tenant authority from the authenticated Admin", () => {
    expect(action).toContain('context.access.role !== "ADMIN"');
    expect(action).toContain('"create_loyalty_program"');
    expect(action).toContain('"configure_loyalty_program"');
    expect(action).not.toContain('formData.get("tenant');
    expect(migration).toContain("sp.id = auth.uid()");
    expect(migration).toContain("sp.role = 'ADMIN'");
    expect(migration).not.toContain("target_tenant_id");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("'previous_name', old.name");
    expect(migration).toContain("not between 1 and 120");
    expect(migration).toContain("return app.configure_loyalty_program(");
  });
});
