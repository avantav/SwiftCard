import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/0049_lifetime_points_engine.sql", import.meta.url),
  "utf8",
);
const casaGarmendiaRepair = readFileSync(
  new URL("../../../supabase/migrations/0056_casa_garmendia_points_repair.sql", import.meta.url),
  "utf8",
);
const publicCard = readFileSync(
  new URL("../../components/public-wallet-card.tsx", import.meta.url),
  "utf8",
);
const cardFields = readFileSync(
  new URL("../../components/card-program-fields.tsx", import.meta.url),
  "utf8",
);
const cardActions = readFileSync(
  new URL("../../app/admin/cards/actions.ts", import.meta.url),
  "utf8",
);
const exportRoute = readFileSync(
  new URL("../../app/api/admin/exports/route.ts", import.meta.url),
  "utf8",
);

describe("lifetime point engine", () => {
  it("stores exact tenths without a cyclic modulo and grants each milestone once", () => {
    expect(migration).toContain("lifetime_points_tenths bigint not null default 0");
    expect(migration).toContain("target_amount_minor::numeric * 10");
    expect(migration).toContain("tier_record.id, 0,");
    expect(migration).toContain("tier.stamps_required::bigint * 10 <= projected_balance_tenths");
    expect(migration).toContain("Manual lifetime point adjustments are disabled");
    expect(migration).toContain("lifetime_points_cancellations_disabled");
    expect(migration).toContain("sum(purchase.units_awarded_tenths)");
    expect(exportRoute).toContain("units_awarded_tenths");
    expect(exportRoute).toContain("units_awarded: Number(tenths ?? 0) / 10");
  });

  it("exposes a point-specific card design instead of stamp circles", () => {
    expect(cardFields).toContain("Puntos acumulativos sin reinicio");
    expect(cardFields).toContain("Monto gastado para ganar 1 punto");
    expect(cardFields).toContain("una compra de $2,000 otorga 200 puntos");
    expect(cardFields).toContain('name="confirmProgramTypeChange"');
    expect(cardActions).toContain("Confirma el cambio de tipo de programa antes de guardar.");
    expect(publicCard).toContain("wallet-points-progress");
    expect(publicCard).toContain("Todos los hitos desbloqueados");
    expect(publicCard).toContain("lifetimePoints ?");
  });

  it("repairs the single Casa Garmendia purchase without erasing its redemption history", () => {
    expect(casaGarmendiaRepair).toContain("amount_per_stamp_minor = 1000");
    expect(casaGarmendiaRepair).toContain("units_awarded_tenths = 2000");
    expect(casaGarmendiaRepair).toContain("lifetime_points_tenths = 2000");
    expect(casaGarmendiaRepair).toContain("status = 'REVERSED'");
    expect(casaGarmendiaRepair).toContain("tier.stamps_required > 200");
    expect(casaGarmendiaRepair).toContain("CASA_GARMENDIA_POINTS_RULE_REPAIRED");
    expect(casaGarmendiaRepair).toContain("production state changed");
  });
});
