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
const programTypeControls = readFileSync(
  join(process.cwd(), "src/components/program-type-controls.tsx"),
  "utf8",
);
const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/0034_tiered_rewards_and_card_terms.sql",
  ),
  "utf8",
);
const configurableTypesMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/0040_configurable_loyalty_program_types.sql",
  ),
  "utf8",
);
const adminTypeChangesMigration = readFileSync(
  new URL(
    "../../../supabase/migrations/0041_admin_program_type_changes.sql",
    import.meta.url,
  ),
  "utf8",
);
const stampToPointConversionMigration = readFileSync(
  new URL(
    "../../../supabase/migrations/0042_stamp_to_point_balance_conversion.sql",
    import.meta.url,
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
        programType: "STAMPS_PER_PURCHASE",
        ruleType: "PER_PURCHASE",
        minimumPurchaseMinor: 10050,
        stampsPerPurchase: 2,
        amountPerStampMinor: null,
        carryRemainder: false,
        unitNameSingular: "sello",
        unitNamePlural: "sellos",
        welcomeRewardEnabled: false,
        welcomeRewardName: null,
        welcomeRewardDescription: null,
        welcomeRewardExpirationDays: null,
        grantWelcomeRewardToImports: false,
        importStampToPointMultiplier: 1,
        allowPurchaseCancellations: true,
        allowRewardCancellations: true,
        allowRedemptionReversals: true,
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
        programType: "STAMPS_PER_AMOUNT",
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

  it("normalizes configurable lifetime points without resetting milestones", () => {
    expect(
      validateLoyaltyProgramForm(
        form({
          configurationOptionsPresent: "1",
          name: "Puntos Garmendia",
          status: "PAUSED",
          programType: "LIFETIME_POINTS",
          pointsAmount: "10",
          unitNameSingular: "punto",
          unitNamePlural: "puntos",
          welcomeRewardEnabled: "on",
          welcomeRewardName: "Churro individual",
          welcomeRewardDescription: "Beneficio único de registro.",
          welcomeRewardExpirationDays: "30",
          grantWelcomeRewardToImports: "on",
          importStampToPointMultiplier: "10",
          allowRedemptionReversals: "on",
          termsAndConditions: "Aplican condiciones del programa Garmendia.",
          tierStamps: ["100", "200", "300"],
          tierName: ["Café", "Chilaquiles", "Descuento"],
          tierDescription: ["Dos bebidas", "Sin proteína", "Quince por ciento"],
          tierExpirationDays: ["", "30", ""],
        }),
        "MXN",
      ),
    ).toMatchObject({
      ok: true,
      data: {
        programType: "LIFETIME_POINTS",
        ruleType: "PER_AMOUNT",
        amountPerStampMinor: 1000,
        carryRemainder: false,
        unitNameSingular: "punto",
        unitNamePlural: "puntos",
        welcomeRewardEnabled: true,
        welcomeRewardName: "Churro individual",
        welcomeRewardExpirationDays: 30,
        grantWelcomeRewardToImports: true,
        importStampToPointMultiplier: 10,
        allowPurchaseCancellations: false,
        allowRewardCancellations: false,
        allowRedemptionReversals: true,
      },
    });
  });

  it("accepts more than ten reward levels", () => {
    const levels = Array.from({ length: 12 }, (_, index) => String(index + 1));
    expect(
      validateLoyaltyProgramForm(
        form({
          name: "Catálogo amplio",
          status: "PAUSED",
          programType: "LIFETIME_POINTS",
          pointsAmount: "10",
          termsAndConditions: "Aplican condiciones del catálogo amplio.",
          tierStamps: levels,
          tierName: levels.map((level) => `Premio ${level}`),
          tierDescription: levels.map((level) => `Descripción ${level}`),
          tierExpirationDays: levels.map(() => ""),
        }),
        "MXN",
      ),
    ).toMatchObject({ ok: true });
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
    expect(action).toContain('"save_loyalty_program_configuration"');
    expect(action).not.toContain('formData.get("tenant');
    expect(migration).toContain("sp.id = auth.uid()");
    expect(migration).toContain("sp.role = 'ADMIN'");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("not between 1 and 120");
    expect(migration).toContain("target_reward_tiers jsonb");
    expect(migration).toContain("LOYALTY_REWARD_TIERS_CONFIGURED");
    expect(migration).toContain("staff_record.tenant_id");
    expect(configurableTypesMigration).toContain("'LIFETIME_POINTS'");
    expect(configurableTypesMigration).toContain("LOYALTY_PROGRAM_OPTIONS_CONFIGURED");
    expect(adminTypeChangesMigration).toContain("LOYALTY_PROGRAM_TYPE_CHANGED");
    expect(adminTypeChangesMigration).toContain("'FUTURE_PURCHASES'");
    expect(stampToPointConversionMigration).toContain("'STAMPS_TO_POINTS'");
    expect(stampToPointConversionMigration).toContain("target_multiplier");
    expect(stampToPointConversionMigration).toContain("'PROGRAM_CHANGE'");
    expect(stampToPointConversionMigration).toContain(
      "LOYALTY_PROGRAM_BALANCES_CONVERTED",
    );
    expect(adminTypeChangesMigration).not.toContain("'TYPE_LOCKED'");
    expect(action).toContain('formData.get("confirmProgramTypeChange")');
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
    expect(rewardTiersEditor).not.toContain("tiers.length >= 10");
  });

  it("keeps lifetime points paused while the calculation engine is pending", () => {
    expect(programTypeControls).toContain("const forcedPaused = lifetimePoints || changingType");
    expect(programTypeControls).toContain('nextType === initialType ? initialStatus : "PAUSED"');
    expect(programTypeControls).toContain('disabled={forcedPaused} value="ACTIVE"');
  });

  it("requires explicit confirmation when the Admin changes program type", () => {
    expect(programTypeControls).toContain("changingType");
    expect(programTypeControls).toContain('name="confirmProgramTypeChange"');
    expect(programTypeControls).toContain("Confirmo el cambio de tipo de programa");
    expect(programTypeControls).toContain("compras futuras");
    expect(programTypeControls).toContain("Los sellos actuales se convertirán a puntos");
  });
});
