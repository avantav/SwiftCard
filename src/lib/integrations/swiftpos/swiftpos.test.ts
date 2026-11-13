import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBranchLinkForm, parseLimitsForm } from "./admin-forms";
import { apiKeyHashFromHeader, generateApiKey, hashApiKey } from "./api-key";
import { errorFromDatabaseResult, parsePurchaseRequest, parseResolveRequest } from "./requests";
import { SCAN_TICKET_TTL_MS, scanTicketSecret, signScanTicket, verifyScanTicket } from "./scan-ticket";

const CARD = "81400000-0000-0000-0000-000000000021";
const INTEGRATION = "81500000-0000-0000-0000-000000000001";
const BRANCH = "81000000-0000-0000-0000-0000000000b1";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const validPurchase = {
  storeId: "store-1",
  scanTicket: "v1.payload.signature",
  externalSaleId: "8f9e1c2a-1111-4222-8333-944455556666",
  ticketNumber: " A-001234 ",
  amountMinor: 18550,
  occurredAt: "2026-11-13T18:20:00Z",
  cashier: { id: "emp-7", name: "Luis P." }
};

describe("API keys", () => {
  it("generates keys with a database-compatible prefix and stores only their hash", () => {
    const first = generateApiKey();
    const second = generateApiKey();
    expect(first.key).toMatch(/^sc_live_[a-z0-9]{8}_[A-Za-z0-9_-]{43}$/);
    expect(first.prefix).toMatch(/^[a-z0-9]{8}$/);
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.hash).toBe(hashApiKey(first.key));
    expect(first.key).not.toBe(second.key);
  });

  it("only accepts well-formed bearer keys", () => {
    const { key, hash } = generateApiKey();
    expect(apiKeyHashFromHeader(`Bearer ${key}`)).toBe(hash);
    expect(apiKeyHashFromHeader(null)).toBeNull();
    expect(apiKeyHashFromHeader(key)).toBeNull();
    expect(apiKeyHashFromHeader(`Basic ${key}`)).toBeNull();
    expect(apiKeyHashFromHeader("Bearer sc_live_short_x")).toBeNull();
    expect(apiKeyHashFromHeader(`Bearer ${key} extra`)).toBeNull();
  });
});

describe("scan tickets", () => {
  const secret = randomBytes(32);
  const claims = { customerCardId: CARD, integrationId: INTEGRATION, branchId: BRANCH };

  it("round-trips and expires after 72 hours", () => {
    const now = 1_000_000;
    const token = signScanTicket(claims, secret, now);
    expect(verifyScanTicket(token, secret, now + 1000)).toEqual({ ok: true, claims: { ...claims, expiresAt: now + SCAN_TICKET_TTL_MS } });
    expect(verifyScanTicket(token, secret, now + SCAN_TICKET_TTL_MS)).toEqual({ ok: false, reason: "EXPIRED" });
  });

  it("rejects tampering, other secrets and malformed tokens", () => {
    const token = signScanTicket(claims, secret);
    const [version, payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ c: "81400000-0000-0000-0000-000000000099", i: INTEGRATION, b: BRANCH, e: Date.now() + 1000 })).toString("base64url");
    expect(verifyScanTicket(`${version}.${forged}.${signature}`, secret)).toEqual({ ok: false, reason: "INVALID" });
    expect(verifyScanTicket(token, randomBytes(32))).toEqual({ ok: false, reason: "INVALID" });
    expect(verifyScanTicket(`${version}.${payload}`, secret)).toEqual({ ok: false, reason: "INVALID" });
    expect(verifyScanTicket(`${token}.x`, secret)).toEqual({ ok: false, reason: "INVALID" });
    expect(verifyScanTicket(42, secret)).toEqual({ ok: false, reason: "INVALID" });
  });

  it("requires a 32-byte base64 secret", () => {
    expect(scanTicketSecret(undefined)).toBeNull();
    expect(scanTicketSecret("")).toBeNull();
    expect(scanTicketSecret(Buffer.alloc(16).toString("base64"))).toBeNull();
    expect(scanTicketSecret(randomBytes(32).toString("base64"))?.length).toBe(32);
  });
});

describe("request validation", () => {
  it("validates resolve requests", () => {
    expect(parseResolveRequest({ storeId: "store-1", scan: " https://x/scan/q1_abc " })).toEqual({ ok: true, data: { storeId: "store-1", scan: "https://x/scan/q1_abc" } });
    expect(parseResolveRequest({ storeId: "bad store", scan: "x" }).ok).toBe(false);
    expect(parseResolveRequest({ storeId: "store-1", scan: "" }).ok).toBe(false);
    expect(parseResolveRequest(null).ok).toBe(false);
  });

  it("validates purchases and normalizes dates and tickets", () => {
    const parsed = parsePurchaseRequest(validPurchase);
    expect(parsed).toEqual({ ok: true, data: { ...validPurchase, ticketNumber: "A-001234", occurredAt: "2026-11-13T18:20:00.000Z", location: null } });
    expect(parsePurchaseRequest({ ...validPurchase, location: { latitude: 29.07, longitude: -110.95 } }).ok).toBe(true);
  });

  it("rejects invalid purchases", () => {
    for (const change of [
      { amountMinor: 0 },
      { amountMinor: 12.5 },
      { amountMinor: "18550" },
      { occurredAt: "ayer" },
      { cashier: { id: "", name: "Luis" } },
      { cashier: undefined },
      { externalSaleId: "venta 1" },
      { ticketNumber: "x".repeat(61) },
      { location: { latitude: 91, longitude: 0 } },
      { location: { latitude: 29 } }
    ]) {
      expect(parsePurchaseRequest({ ...validPurchase, ...change }).ok, JSON.stringify(change)).toBe(false);
    }
  });

  it("maps database results to stable API errors", () => {
    expect(errorFromDatabaseResult("INVALID")).toBe("INVALID_REQUEST");
    expect(errorFromDatabaseResult("DUPLICATE_TICKET")).toBe("DUPLICATE_TICKET");
    expect(errorFromDatabaseResult("something else")).toBe("SERVICE_UNAVAILABLE");
    expect(errorFromDatabaseResult(undefined)).toBe("SERVICE_UNAVAILABLE");
  });
});

describe("Superadmin forms", () => {
  it("validates branch links and allows removing them", () => {
    expect(parseBranchLinkForm(form({ storeId: "store-1", branchId: BRANCH, reason: "Caja centro" }))).toEqual({ ok: true, data: { storeId: "store-1", branchId: BRANCH, reason: "Caja centro" } });
    expect(parseBranchLinkForm(form({ storeId: "store-1", branchId: "", reason: "Baja" }))).toEqual({ ok: true, data: { storeId: "store-1", branchId: null, reason: "Baja" } });
    expect(parseBranchLinkForm(form({ storeId: "store 1", branchId: BRANCH, reason: "Caja" })).ok).toBe(false);
  });

  it("converts the maximum amount to minor units and checks limits", () => {
    expect(parseLimitsForm(form({ maxAmount: "15000.5", maxPerHour: "5", maxPerDay: "20", reason: "Ajuste" }))).toEqual({
      ok: true,
      data: { maxAmountMinor: 1500050, maxPerHour: 5, maxPerDay: 20, reason: "Ajuste" }
    });
    expect(parseLimitsForm(form({ maxAmount: "0", maxPerHour: "5", maxPerDay: "20", reason: "Ajuste" })).ok).toBe(false);
    expect(parseLimitsForm(form({ maxAmount: "100", maxPerHour: "30", maxPerDay: "20", reason: "Ajuste" })).ok).toBe(false);
    expect(parseLimitsForm(form({ maxAmount: "1.234", maxPerHour: "5", maxPerDay: "20", reason: "Ajuste" })).ok).toBe(false);
  });
});

describe("SwiftPOS integration migration", () => {
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/0081_swiftpos_integration.sql"), "utf8");
  const original = readFileSync(join(process.cwd(), "supabase/migrations/0049_lifetime_points_engine.sql"), "utf8");

  it("keeps the employee purchase function untouched", () => {
    expect(migration).not.toMatch(/function app\.confirm_card_purchase/);
    expect(migration).toContain("create or replace function app.enforce_purchase_location()");
  });

  it("copies the calculation rules of 0049 verbatim", () => {
    const rules = [
      "calculated_tenths := floor(\n      target_amount_minor::numeric * 10 / program_record.amount_per_stamp_minor\n    )::bigint;",
      "calculated_stamps := case when target_amount_minor >= program_record.minimum_purchase_minor\n      then program_record.stamps_per_purchase else 0 end;",
      "calculated_stamps := floor((target_amount_minor + case when program_record.carry_remainder\n      then balance_record.remainder_minor else 0 end) / program_record.amount_per_stamp_minor)::integer;",
      "then (target_amount_minor + balance_record.remainder_minor) % program_record.amount_per_stamp_minor\n      else target_amount_minor % program_record.amount_per_stamp_minor end;",
      "select * into tier_result from app.apply_lifetime_point_milestones(",
      "select * into tier_result from app.apply_reward_tiers("
    ];
    for (const rule of rules) {
      expect(original, rule).toContain(rule);
      expect(migration, rule).toContain(rule);
    }
  });

  it("exposes integration functions only to the service role", () => {
    for (const fn of ["integration_status", "integration_resolve_card", "integration_confirm_purchase"]) {
      expect(migration).toMatch(new RegExp(`revoke all on function app\\.${fn}\\([^)]*\\) from public, anon, authenticated;`));
      expect(migration).toMatch(new RegExp(`grant execute on function app\\.${fn}\\([^)]*\\) to service_role;`));
      expect(migration).not.toMatch(new RegExp(`grant execute on function app\\.${fn}\\([^)]*\\) to authenticated`));
    }
    expect(migration).not.toContain("key_hash) to authenticated");
  });
});
