import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "localhost:3000" }) }));
vi.mock("@/lib/customers/card-scan-server", () => ({ createPublicCardScanUrl: () => "https://wallet.example.com/scan/q1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }));

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => { throw new Error("Staff session must not be reused for public enrollment"); } }));
vi.mock("@/lib/supabase/public-server", () => ({ createSupabasePublicServerClient: mocks.client }));
vi.mock("@/lib/wallet/public-availability", () => ({
  isPublicAppleWalletAvailable: vi.fn(async () => true),
  isPublicGoogleWalletAvailable: vi.fn(async () => false),
}));
import { acceptRegistrationTerms, loadRegistrationCard, registerCustomer } from "@/app/register/[branchToken]/actions";

const token = "a".repeat(48);
let accepted = false;
let registrationResult = "CREATED";
let failProjection = false;
let version = 3;
function form() {
  const data = new FormData();
  data.set("loyaltyCardId", "published-card");
  data.set("fullName", "Ana Pérez");
  data.set("phone", "+526621234567");
  data.set("privacyConsent", "on");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  accepted = false; registrationResult = "CREATED"; failProjection = false; version = 3;
  mocks.client.mockReturnValue({ schema: () => ({ rpc: mocks.rpc }) });
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === "register_public_customer") return { data: [{ result: registrationResult, card_token: token }], error: null };
    if (name === "get_public_card_claim") return { data: [{ customer_name: "Ana Pérez", program_version: version, terms_and_conditions: "Condiciones vigentes" }], error: failProjection ? {} : null };
    if (name === "get_public_web_card") return { data: [{ customer_name: "Ana Pérez", stamp_balance: 0, available_rewards: [] }], error: null };
    if (name === "public_card_terms_are_accepted") return { data: accepted, error: null };
    if (name === "accept_public_card_terms") { accepted = true; return { data: "ACCEPTED", error: null }; }
    throw new Error(`Unexpected RPC: ${name}`);
  });
});

describe("single-page customer registration", () => {
  it("returns the issued card and a real QR without redirecting or accepting terms implicitly", async () => {
    const result = await registerCustomer("branch-token", {}, form());
    expect(result.cardToken).toBe(token);
    expect(result.card?.customer_name).toBe("Ana Pérez");
    expect(result.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.accepted).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledWith("register_public_customer", expect.objectContaining({ target_branch_token: "branch-token", target_loyalty_card_id: "published-card" }));
    expect(mocks.rpc.mock.calls.some(([name]) => name === "accept_public_card_terms")).toBe(false);
  });

  it("accepts the displayed terms in the same submission when explicitly checked", async () => {
    const data = form(); data.set("acceptTerms", "on"); data.set("programVersion", "3");
    const result = await registerCustomer("branch-token", {}, data);
    expect(result.accepted).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("accept_public_card_terms", { target_card_token: token, target_program_version: 3 });
  });

  it("does not accept a changed terms version during registration", async () => {
    const data = form(); data.set("acceptTerms", "on"); data.set("programVersion", "2");
    const result = await registerCustomer("branch-token", {}, data);
    expect(result.accepted).toBe(false);
    expect(result.error).toMatch(/términos cambiaron/);
    expect(mocks.rpc.mock.calls.some(([name]) => name === "accept_public_card_terms")).toBe(false);
  });

  it("recovers imported customers into the same inline terms flow", async () => {
    registrationResult = "IMPORTED_RECOVERY";
    const result = await registerCustomer("branch-token", {}, form());
    expect(result.cardToken).toBe(token);
    expect(result.claim?.program_version).toBe(3);
    expect(result.accepted).toBe(false);
  });

  it("never reveals a duplicate customer's token", async () => {
    registrationResult = "DUPLICATE";
    const result = await registerCustomer("branch-token", {}, form());
    expect(result.error).toMatch(/ya está registrado/);
    expect(result.cardToken).toBeUndefined();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("keeps the issued token when delivery fails and retries without a second registration", async () => {
    failProjection = true;
    const result = await registerCustomer("branch-token", {}, form());
    expect(result.cardToken).toBe(token);
    expect(result.error).toMatch(/registro se guardó/);
    failProjection = false;
    const retry = await registerCustomer("branch-token", result, form());
    expect(retry.claim).toBeDefined();
    expect(mocks.rpc.mock.calls.filter(([name]) => name === "register_public_customer")).toHaveLength(1);
  });

  it("requires explicit acceptance and the currently displayed program version", async () => {
    const missingConsent = await acceptRegistrationTerms(token, 3, {}, new FormData());
    expect(missingConsent.accepted).toBe(false);
    const consent = new FormData(); consent.set("acceptTerms", "on");
    version = 4;
    const stale = await acceptRegistrationTerms(token, 3, {}, consent);
    expect(stale.claim?.program_version).toBe(4);
    expect(stale.error).toMatch(/términos cambiaron/);
    expect(mocks.rpc.mock.calls.some(([name]) => name === "accept_public_card_terms")).toBe(false);
    const saved = await acceptRegistrationTerms(token, 4, stale, consent);
    expect(saved.accepted).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("accept_public_card_terms", { target_card_token: token, target_program_version: 4 });
  });

  it("rejects invalid tokens before making any database request", async () => {
    expect((await loadRegistrationCard("invalid")).cardToken).toBeUndefined();
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("validates registration before performing mutations", async () => {
    const data = form(); data.set("phone", "wrong");
    expect((await registerCustomer("branch-token", {}, data)).error).toBeTruthy();
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
