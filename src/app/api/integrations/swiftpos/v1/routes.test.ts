import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ schema: () => ({ rpc }) })
}));
const dispatch = vi.fn(async () => ({}));
vi.mock("@/lib/wallet/activity-dispatch", () => ({ dispatchCustomerActivityBestEffort: dispatch }));
vi.mock("@/lib/customers/card-scan-server", () => ({ openPublicCardScanToken: () => null }));

const { generateApiKey } = await import("@/lib/integrations/swiftpos/api-key");
const { signScanTicket } = await import("@/lib/integrations/swiftpos/scan-ticket");
const resolveRoute = await import("./cards/resolve/route");
const purchasesRoute = await import("./purchases/route");
const statusRoute = await import("./status/route");

const SECRET = randomBytes(32);
const { key, hash } = generateApiKey();
const CARD = "81400000-0000-0000-0000-000000000021";
const INTEGRATION = "81500000-0000-0000-0000-000000000001";
const BRANCH = "81000000-0000-0000-0000-0000000000b1";
const RAW_TOKEN = "t".repeat(43);

function request(path: string, body?: unknown, auth = `Bearer ${key}`) {
  return new Request(`https://swiftcard.test/api/integrations/swiftpos/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function purchaseBody(overrides: Record<string, unknown> = {}) {
  return {
    storeId: "store-1",
    scanTicket: signScanTicket({ customerCardId: CARD, integrationId: INTEGRATION, branchId: BRANCH }, SECRET),
    externalSaleId: "sale-1",
    ticketNumber: "A-1",
    amountMinor: 18550,
    occurredAt: new Date().toISOString(),
    cashier: { id: "emp-7", name: "Luis P." },
    ...overrides
  };
}

beforeEach(() => {
  process.env.SWIFTPOS_SCAN_TICKET_SECRET = SECRET.toString("base64");
  rpc.mockReset();
  dispatch.mockClear();
});
afterEach(() => {
  delete process.env.SWIFTPOS_SCAN_TICKET_SECRET;
});

describe("SwiftPOS API authentication", () => {
  it("rejects missing or malformed keys before touching the database", async () => {
    for (const auth of ["", "Bearer nope", `Token ${key}`]) {
      const response = await resolveRoute.POST(request("cards/resolve", { storeId: "store-1", scan: RAW_TOKEN }, auth));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed without the scan ticket secret", async () => {
    delete process.env.SWIFTPOS_SCAN_TICKET_SECRET;
    const response = await purchasesRoute.POST(request("purchases", purchaseBody()));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "NOT_CONFIGURED" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends only the key hash to the database", async () => {
    rpc.mockResolvedValue({ data: [{ result: "OK", modules: { swiftpos_integration: true } }], error: null });
    const response = await statusRoute.GET(request("status"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(rpc).toHaveBeenCalledWith("integration_status", { target_key_hash: hash });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(key);
  });
});

describe("POST /cards/resolve", () => {
  it("returns a signed scan ticket and only the first name", async () => {
    rpc.mockResolvedValue({
      data: [{
        result: "FOUND", integration_id: INTEGRATION, branch_id: BRANCH, customer_card_id: CARD,
        first_name: "Ana", card_name: "Café frecuente", program_type: "STAMPS_PER_PURCHASE", balance: 7,
        unit_name_singular: "sello", unit_name_plural: "sellos", available_rewards: 1
      }],
      error: null
    });
    const response = await resolveRoute.POST(request("cards/resolve", { storeId: "store-1", scan: RAW_TOKEN }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("integration_resolve_card", { target_key_hash: hash, target_external_store_id: "store-1", target_card_token: RAW_TOKEN });
    expect(payload.scanTicket).toMatch(/^v1\./);
    expect(payload.customer).toEqual({ firstName: "Ana" });
    expect(payload.card).toEqual({ name: "Café frecuente", programType: "STAMPS_PER_PURCHASE", balance: 7, unit: { singular: "sello", plural: "sellos" }, availableRewards: 1 });
    expect(JSON.stringify(payload)).not.toContain(CARD);
  });

  it("maps database rejections", async () => {
    rpc.mockResolvedValue({ data: [{ result: "MODULE_NOT_ACTIVE" }], error: null });
    const response = await resolveRoute.POST(request("cards/resolve", { storeId: "store-1", scan: RAW_TOKEN }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "MODULE_NOT_ACTIVE" });
  });

  it("hides database errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "relation does not exist" } });
    const response = await resolveRoute.POST(request("cards/resolve", { storeId: "store-1", scan: RAW_TOKEN }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "SERVICE_UNAVAILABLE" });
  });
});

describe("POST /purchases", () => {
  it("records the sale with the scan ticket claims and notifies the customer", async () => {
    rpc
      .mockResolvedValueOnce({ data: [{ result: "CONFIRMED", purchase_id: "p1", stamps_awarded: 1, rewards_generated: 0, balance: 8, customer_id: "c1" }], error: null })
      .mockResolvedValueOnce({ data: [{ result: "OK", modules: { "swiftpos_integration.wallet_refresh": true } }], error: null });
    const response = await purchasesRoute.POST(request("purchases", purchaseBody({ location: { latitude: 29.07, longitude: -110.95 } })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: "CONFIRMED", stampsAwarded: 1, rewardsGenerated: 0, balance: 8 });
    expect(rpc.mock.calls[0][0]).toBe("integration_confirm_purchase");
    expect(rpc.mock.calls[0][1]).toMatchObject({
      target_key_hash: hash,
      target_customer_card_id: CARD,
      target_expected_integration_id: INTEGRATION,
      target_expected_branch_id: BRANCH,
      target_external_sale_id: "sale-1",
      target_amount_minor: 18550,
      target_operator_name: "Luis P.",
      target_latitude: 29.07,
      target_longitude: -110.95
    });
    expect(dispatch).toHaveBeenCalledWith({ customerId: "c1" });
  });

  it("does not notify when the wallet switch is stopped or the sale was already recorded", async () => {
    rpc
      .mockResolvedValueOnce({ data: [{ result: "CONFIRMED", purchase_id: "p1", stamps_awarded: 1, rewards_generated: 0, balance: 8, customer_id: "c1" }], error: null })
      .mockResolvedValueOnce({ data: [{ result: "OK", modules: { "swiftpos_integration.wallet_refresh": false } }], error: null });
    expect((await purchasesRoute.POST(request("purchases", purchaseBody()))).status).toBe(200);
    rpc.mockResolvedValueOnce({ data: [{ result: "ALREADY_RECORDED", purchase_id: "p1", stamps_awarded: 1, rewards_generated: 0, balance: 8, customer_id: "c1" }], error: null });
    const retry = await purchasesRoute.POST(request("purchases", purchaseBody()));
    expect(await retry.json()).toMatchObject({ result: "ALREADY_RECORDED" });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("keeps the purchase when notifying fails", async () => {
    rpc
      .mockResolvedValueOnce({ data: [{ result: "CONFIRMED", purchase_id: "p1", stamps_awarded: 1, rewards_generated: 0, balance: 8, customer_id: "c1" }], error: null })
      .mockRejectedValueOnce(new Error("network"));
    const response = await purchasesRoute.POST(request("purchases", purchaseBody()));
    expect(response.status).toBe(200);
  });

  it("rejects forged, expired or missing scan tickets before the database", async () => {
    const forged = purchaseBody({ scanTicket: signScanTicket({ customerCardId: CARD, integrationId: INTEGRATION, branchId: BRANCH }, randomBytes(32)) });
    expect(await (await purchasesRoute.POST(request("purchases", forged))).json()).toEqual({ error: "SCAN_TICKET_INVALID" });
    const expired = purchaseBody({ scanTicket: signScanTicket({ customerCardId: CARD, integrationId: INTEGRATION, branchId: BRANCH }, SECRET, Date.now() - 73 * 3600 * 1000) });
    expect(await (await purchasesRoute.POST(request("purchases", expired))).json()).toEqual({ error: "SCAN_TICKET_EXPIRED" });
    expect((await purchasesRoute.POST(request("purchases", purchaseBody({ scanTicket: undefined })))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects oversized bodies", async () => {
    const response = await purchasesRoute.POST(request("purchases", purchaseBody({ ticketNumber: "x".repeat(9000) })));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps duplicate tickets and limits", async () => {
    rpc.mockResolvedValueOnce({ data: [{ result: "DUPLICATE_TICKET", stamps_awarded: 0, rewards_generated: 0 }], error: null });
    const duplicate = await purchasesRoute.POST(request("purchases", purchaseBody()));
    expect(duplicate.status).toBe(409);
    rpc.mockResolvedValueOnce({ data: [{ result: "LIMIT_EXCEEDED", stamps_awarded: 0, rewards_generated: 0 }], error: null });
    const limited = await purchasesRoute.POST(request("purchases", purchaseBody()));
    expect(limited.status).toBe(422);
    expect(await limited.json()).toEqual({ error: "LIMIT_EXCEEDED" });
  });
});
