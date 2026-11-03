import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), open: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ requireInternalArea: mocks.auth }));
vi.mock("@/lib/customers/card-scan-server", () => ({ openPublicCardScanToken: mocks.open }));
vi.mock("@/lib/wallet/apple-apns", () => ({ dispatchAppleWalletUpdatesBestEffort: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
import { resolveScannedCard } from "@/app/app/scan/actions";
const scanUrl = `https://wallet.example.com/scan/q1_${"x".repeat(94)}`;
function scanForm() { const form = new FormData(); form.set("payload", scanUrl); return form; }

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ supabase: { schema: () => ({ rpc: mocks.rpc }) } });
  mocks.open.mockReturnValue("private-possession-token");
});

describe("authenticated public QR resolution", () => {
  it("checks the staff session before opening the sealed token or querying a customer", async () => {
    mocks.auth.mockRejectedValue(new Error("AUTH_REQUIRED"));
    await expect(resolveScannedCard(scanForm())).rejects.toThrow("AUTH_REQUIRED");
    expect(mocks.open).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not query customer data for a tampered token", async () => {
    mocks.open.mockReturnValue(null);
    await expect(resolveScannedCard(scanForm())).rejects.toThrow("REDIRECT:/app/scan?error=");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("resolves a valid QR for authorized staff without returning the private token", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ result: "FOUND", customer_card_id: "issued-card", loyalty_card_id: "loyalty-card" }], error: null });
    await expect(resolveScannedCard(scanForm())).rejects.toThrow("REDIRECT:/app/scan?customerCardId=issued-card&loyaltyCardId=loyalty-card");
  });
  it("leaves tenant and operator authorization to the existing protected RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ result: "NOT_THIS_TENANT" }], error: null });
    await expect(resolveScannedCard(scanForm())).rejects.toThrow("REDIRECT:/app/scan?error=");
    expect(mocks.rpc).toHaveBeenCalledWith("resolve_staff_card_scan", { target_card_token: "private-possession-token" });
    expect(mocks.auth).toHaveBeenCalledWith("APP", { writable: true });
  });
});
