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
const rewardTiersEditor = readFileSync(
  join(process.cwd(), "src/components/reward-tiers-editor.tsx"),
  "utf8",
);
const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/0034_tiered_rewards_and_card_terms.sql",
  ),
  "utf8",
);

function form(values: Record<string, string | string[]>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => data.append(key, item));
    else data.set(key, value);
  });
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
          termsAndConditions: "Válido en sucursales participantes.",
          tierStamps: ["3", "10"],
          tierName: [" Café pequeño ", " Bebida gratis "],
          tierDescription: ["Un café del día", "Una bebida de cortesía"],
          tierExpirationDays: ["", "30"],
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
        termsAndConditions: "Válido en sucursales participantes.",
        rewardTiers: [
          {
            stampsRequired: 3,
            name: "Café pequeño",
            description: "Un café del día",
            expirationDays: null,
          },
          {
            stampsRequired: 10,
            name: "Bebida gratis",
            description: "Una bebida de cortesía",
            expirationDays: 30,
          },
        ],
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
          termsAndConditions: "Aplican condiciones del programa.",
          tierStamps: ["8"],
          tierName: ["Premio"],
          tierDescription: ["Premio principal"],
          tierExpirationDays: [""],
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
        termsAndConditions: "Aplican condiciones del programa.",
        rewardTiers: [expect.objectContaining({ stampsRequired: 8, expirationDays: null })],
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
          termsAndConditions: "Aplican condiciones del programa.",
          tierStamps: ["10"],
          tierName: ["Premio"],
          tierDescription: ["Premio principal"],
          tierExpirationDays: [""],
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
          termsAndConditions: "corto",
          tierStamps: ["3", "3"],
          tierName: ["Premio", "Premio repetido"],
          tierDescription: ["Descripción", "Otra descripción"],
          tierExpirationDays: ["0", ""],
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
        "Cada nivel debe requerir una cantidad distinta de sellos.",
      ]),
    });
  });

  it("derives tenant authority from the authenticated Admin", () => {
    expect(action).toContain('context.access.role !== "ADMIN"');
    expect(action).toContain('"save_loyalty_program_with_tiers"');
    expect(action).not.toContain('formData.get("tenant');
    expect(migration).toContain("sp.id = auth.uid()");
    expect(migration).toContain("sp.role = 'ADMIN'");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("not between 1 and 120");
    expect(migration).toContain("target_reward_tiers jsonb");
    expect(migration).toContain("LOYALTY_REWARD_TIERS_CONFIGURED");
    expect(migration).toContain("staff_record.tenant_id");
  });

  it("keeps add-level local to the form and reveals the new tier", () => {
    expect(rewardTiersEditor).toContain('type="button">Agregar nivel');
    expect(rewardTiersEditor).toContain("setTiers((current) =>");
    expect(rewardTiersEditor).toContain("scrollIntoView");
    expect(rewardTiersEditor).toContain("?.focus({ preventScroll: true })");
    expect(rewardTiersEditor).toContain("aria-expanded={expanded}");
    expect(rewardTiersEditor).toContain("hidden={!expanded}");
    expect(rewardTiersEditor).toContain('expanded ? "Ocultar" : "Editar"');
    expect(rewardTiersEditor).toContain("setExpandedKeys(new Set([key]))");
  });
});
