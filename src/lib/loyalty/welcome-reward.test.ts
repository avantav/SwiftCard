import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateLoyaltyProgramForm } from "@/lib/admin/program";

const migration = readFileSync(
  new URL("../../../supabase/migrations/0054_optional_welcome_reward.sql", import.meta.url),
  "utf8",
);
const wizard = readFileSync(
  new URL("../../app/admin/cards/[cardId]/edit/page.tsx", import.meta.url),
  "utf8",
);
const actions = readFileSync(
  new URL("../../app/admin/cards/actions.ts", import.meta.url),
  "utf8",
);
const fields = readFileSync(
  new URL("../../components/welcome-reward-fields.tsx", import.meta.url),
  "utf8",
);

function lifetimeProgram(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const values: Record<string, string | string[]> = {
    configurationOptionsPresent: "1",
    name: "Puntos acumulativos",
    status: "PAUSED",
    programType: "LIFETIME_POINTS",
    pointsAmount: "10",
    unitNameSingular: "punto",
    unitNamePlural: "puntos",
    importStampToPointMultiplier: "1",
    termsAndConditions: "Aplican los términos vigentes del programa.",
    tierStamps: ["100"],
    tierName: ["Premio principal"],
    tierDescription: ["Beneficio del primer hito."],
    tierExpirationDays: [""],
    ...overrides,
  };
  Object.entries(values).forEach(([key, value]) => {
    (Array.isArray(value) ? value : [value]).forEach((item) => data.append(key, item));
  });
  return data;
}

describe("optional registration welcome reward", () => {
  it("accepts disabled or complete lifetime-point welcome configuration", () => {
    expect(validateLoyaltyProgramForm(lifetimeProgram(), "MXN")).toMatchObject({
      ok: true,
      data: { welcomeRewardEnabled: false },
    });
    expect(validateLoyaltyProgramForm(lifetimeProgram({
      welcomeRewardEnabled: "on",
      welcomeRewardName: "Bebida de bienvenida",
      welcomeRewardDescription: "Beneficio único por registrarte.",
      welcomeRewardExpirationDays: "30",
    }), "MXN")).toMatchObject({
      ok: true,
      data: {
        welcomeRewardEnabled: true,
        welcomeRewardName: "Bebida de bienvenida",
        welcomeRewardExpirationDays: 30,
      },
    });
  });

  it("rejects an enabled welcome gift without its required copy", () => {
    const result = validateLoyaltyProgramForm(lifetimeProgram({
      welcomeRewardEnabled: "on",
    }), "MXN");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain(
      "El nombre de la recompensa de bienvenida es obligatorio y admite hasta 120 caracteres.",
    );
  });

  it("exposes the option in the card wizard and sends it to the card RPC", () => {
    expect(wizard).toContain("<WelcomeRewardFields");
    expect(wizard).toContain("welcome_reward_enabled");
    expect(fields).toContain("Regalo de bienvenida");
    expect(fields).toContain('name="welcomeRewardEnabled"');
    expect(fields).toContain("Se entrega una sola vez");
    expect(actions).toContain("target_welcome_reward_enabled");
    expect(actions).toContain("target_welcome_reward_expiration_days");
  });

  it("grants at card issuance once and respects imported-customer policy", () => {
    expect(migration).toContain("customer_cards_grant_welcome_reward");
    expect(migration).toContain("rewards_customer_card_welcome_once_idx");
    expect(migration).toContain("where is_welcome_reward");
    expect(migration).toContain("customer.customer_import_id is null");
    expect(migration).toContain("program.grant_welcome_reward_to_imports");
    expect(migration).toContain("CASA_GARMENDIA_LEGACY_STAMPS_2026");
    expect(migration).toContain("stamps_required_snapshot");
  });
});
