import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canAdjustStamps,
  correctionConsequence,
  correctionFor,
  correctionResultMessage,
  validateReason,
  type ActivityItem,
  type CorrectionProgram,
} from "./customer-activity";

const stamps: CorrectionProgram = {
  programType: "STAMPS_PER_PURCHASE",
  unitSingular: "sello",
  unitPlural: "sellos",
  allowPurchaseCancellations: true,
  allowRewardCancellations: true,
  allowRedemptionReversals: true,
};
const lifetime: CorrectionProgram = { ...stamps, programType: "LIFETIME_POINTS", allowPurchaseCancellations: false, allowRewardCancellations: false };

const purchase: ActivityItem = { kind: "purchase", id: "p", at: "2026-11-01T10:00:00Z", branch: "Centro", amountMinor: 12000, ticket: "T-1", units: 2, status: "CONFIRMED", note: null };
const redemption: ActivityItem = { kind: "redemption", id: "r", at: "2026-11-02T10:00:00Z", branch: "Centro", reward: "Café", status: "COMPLETED", note: null };
const reward: ActivityItem = { kind: "reward", id: "w", at: "2026-11-03T10:00:00Z", reward: "Café", status: "AVAILABLE", expiresAt: null, note: null };

describe("customer corrections offered to the Admin general (DEC-0074)", () => {
  it("offers one correction per movement when the program allows it", () => {
    expect(correctionFor(purchase, stamps)).toBe("cancel-purchase");
    expect(correctionFor(redemption, stamps)).toBe("reverse-redemption");
    expect(correctionFor(reward, stamps)).toBe("cancel-reward");
    expect(correctionFor({ ...purchase, status: "CANCELLED" }, stamps)).toBeNull();
    expect(correctionFor({ ...redemption, status: "REVERSED" }, stamps)).toBeNull();
    expect(correctionFor(purchase, null)).toBeNull();
  });

  it("hides disabled options and keeps lifetime points definitive except redemption reversal", () => {
    expect(correctionFor(purchase, { ...stamps, allowPurchaseCancellations: false })).toBeNull();
    expect(correctionFor(reward, { ...stamps, allowRewardCancellations: false })).toBeNull();
    expect(correctionFor(redemption, { ...stamps, allowRedemptionReversals: false })).toBeNull();
    expect(correctionFor(purchase, lifetime)).toBeNull();
    expect(correctionFor(reward, lifetime)).toBeNull();
    expect(correctionFor(redemption, lifetime)).toBe("reverse-redemption");
    expect(canAdjustStamps(stamps)).toBe(true);
    expect(canAdjustStamps(lifetime)).toBe(false);
  });

  it("names the consequence and requires an audited reason", () => {
    const money = (minor: number) => `$${minor / 100}`;
    expect(correctionConsequence("cancel-purchase", purchase, stamps, money)).toContain("se retirarán 2 sellos");
    expect(correctionConsequence("cancel-reward", reward, stamps, money)).toContain("No se devuelven sellos");
    expect(validateReason("  ok ")).toMatchObject({ ok: false });
    expect(validateReason("Ticket duplicado por error")).toEqual({ ok: true, reason: "Ticket duplicado por error" });
    expect(correctionResultMessage("DISABLED")).toContain("desactivada");
    expect(correctionResultMessage(null, "23514")).toContain("desactivada");
    expect(correctionResultMessage("REWARD_ALREADY_REDEEMED")).toContain("revierte el canje");
  });

  it("applies corrections only as a writable Admin general with tenant-scoped reads", () => {
    const actions = readFileSync("src/app/admin/customers/correction-actions.ts", "utf8");
    const loader = readFileSync("src/lib/admin/customer-activity-server.ts", "utf8");
    const drawer = readFileSync("src/components/admin/customer-drawer.tsx", "utf8");
    const page = readFileSync("src/app/admin/customers/page.tsx", "utf8");
    expect(actions).toContain('requireInternalArea("ADMIN", { writable: true })');
    expect(actions).toContain('context.access.role !== "ADMIN"');
    expect(actions).toContain("UUID.test(targetId)");
    expect(loader).not.toContain("createSupabaseAdminClient");
    expect(loader).toContain('.eq("id", customerId).eq("tenant_id", tenantId)');
    expect(drawer).toContain("readOnly ? null : correctionFor(item, program)");
    expect(page).toContain("readOnly={Boolean(context.supportSession) || context.access.role !== \"ADMIN\"}");
  });

  it("enforces the program options in the database", () => {
    const migration = readFileSync("supabase/migrations/0081_enforce_correction_options.sql", "utf8");
    expect(migration).toContain("return 'DISABLED';");
    expect(migration).toContain("not program.allow_reward_cancellations");
    expect(migration).toContain("not program.allow_redemption_reversals");
    expect(migration).toContain("before update of status on public.reward_redemptions");
  });
});
