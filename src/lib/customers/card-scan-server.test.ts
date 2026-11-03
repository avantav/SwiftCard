import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: mock.from }) }));
import { createPublicCardScanUrl, getCardRegistrationPath, openPublicCardScanToken } from "./card-scan-server";
import { GET } from "@/app/scan/[scanToken]/route";
import { isPublicCardScanUrl } from "./card-scan-url";

const privateToken = "private-customer-possession-token-".repeat(2);
let rows: Record<string, Array<Record<string, unknown>>>;
const queries: Array<{ table: string; columns: string; filters: Array<[string, unknown]> }> = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-secret-not-a-credential");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("CARD_SCAN_SECRET_BASE64", "");
  vi.stubEnv("SWIFTWALLET_PUBLIC_URL", "");
  queries.length = 0;
  rows = {
    customer_cards: [{ tenant_id: "tenant-a", customer_id: "customer-a", loyalty_card_id: "card-a", public_token: privateToken, status: "ACTIVE" }],
    customers: [{ id: "customer-a", tenant_id: "tenant-a", source_branch_id: "branch-a", status: "ACTIVE", full_name: "Sensitive name", normalized_phone: "+526621234567" }],
    tenants: [{ id: "tenant-a", status: "ACTIVE" }],
    loyalty_cards: [{ id: "card-a", tenant_id: "tenant-a", status: "PUBLISHED" }],
    branches: [{ id: "branch-a", tenant_id: "tenant-a", public_registration_token: "public-branch-token", status: "ACTIVE" }],
    loyalty_card_branches: [{ branch_id: "branch-a", loyalty_card_id: "card-a" }],
  };
  mock.from.mockImplementation((table: string) => {
    const query = { table, columns: "", filters: [] as Array<[string, unknown]> }; queries.push(query);
    const builder = {
      select(columns: string) { query.columns = columns; return builder; },
      eq(column: string, value: unknown) { query.filters.push([column, value]); return builder; },
      async maybeSingle() {
        const found = rows[table]?.find((row) => query.filters.every(([column, value]) => row[column] === value));
        const data = found ? Object.fromEntries(query.columns.split(",").map((key) => [key, found[key]])) : null;
        return { data, error: null };
      },
    };
    return builder;
  });
});
afterEach(() => vi.unstubAllEnvs());

function scanToken() {
  return new URL(createPublicCardScanUrl(privateToken, "https://wallet.example.com")).pathname.split("/").at(-1)!;
}

describe("public-camera QR privacy", () => {
  it("uses authenticated encryption, fresh nonces and no readable possession token", () => {
    const first = scanToken(), second = scanToken();
    expect(first).not.toBe(second);
    expect(first).not.toContain(privateToken);
    expect(Buffer.from(first.slice(3), "base64url").toString()).not.toContain(privateToken);
    expect(openPublicCardScanToken(first)).toBe(privateToken);
    expect(isPublicCardScanUrl(`https://wallet.example.com/scan/${first}`)).toBe(true);
    expect(isPublicCardScanUrl(`https://wallet.example.com/card/${privateToken}`)).toBe(false);
    expect(isPublicCardScanUrl(`https://attacker:password@wallet.example.com/scan/${first}`)).toBe(false);
  });

  it("rejects tampering, a changed key, malformed tokens and cross-purpose input", () => {
    const sealed = scanToken();
    const bytes = Buffer.from(sealed.slice(3), "base64url"); bytes[20] ^= 1;
    expect(openPublicCardScanToken(`q1_${bytes.toString("base64url")}`)).toBeNull();
    expect(openPublicCardScanToken(privateToken)).toBeNull();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "different-test-key");
    expect(openPublicCardScanToken(sealed)).toBeNull();
  });

  it("supports a dedicated stable server key independent of Supabase credential rotation", () => {
    vi.stubEnv("CARD_SCAN_SECRET_BASE64", Buffer.alloc(32, 8).toString("base64"));
    const sealed = scanToken();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "rotated-service-key");
    expect(openPublicCardScanToken(sealed)).toBe(privateToken);
    vi.stubEnv("CARD_SCAN_SECRET_BASE64", "invalid");
    expect(openPublicCardScanToken(sealed)).toBeNull();
  });

  it("redirects only to the originating tenant branch and selected public card without PII", async () => {
    const sealed = scanToken();
    const response = await GET(new Request(`https://wallet.example.com/scan/${sealed}`), { params: Promise.resolve({ scanToken: sealed }) });
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("https://wallet.example.com/register/public-branch-token?card=card-a");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(await response.text()).toBe("");
    const publicResponse = JSON.stringify([...response.headers]);
    expect(publicResponse).not.toContain(privateToken);
    expect(publicResponse).not.toContain("customer-a");
    expect(publicResponse).not.toContain("Sensitive name");
    expect(queries.map((query) => query.columns).join()).not.toMatch(/full_name|normalized_phone|email|birth_date/);
  });

  it.each(["cross-tenant-branch", "inactive-branch", "suspended-tenant", "unpublished-card", "removed-branch-assignment", "inactive-customer", "revoked-card"])("fails closed for %s", async (scenario) => {
    if (scenario === "cross-tenant-branch") rows.branches[0].tenant_id = "tenant-b";
    if (scenario === "inactive-branch") rows.branches[0].status = "INACTIVE";
    if (scenario === "suspended-tenant") rows.tenants[0].status = "SUSPENDED";
    if (scenario === "unpublished-card") rows.loyalty_cards[0].status = "DRAFT";
    if (scenario === "removed-branch-assignment") rows.loyalty_card_branches = [];
    if (scenario === "inactive-customer") rows.customers[0].status = "INACTIVE";
    if (scenario === "revoked-card") rows.customer_cards[0].status = "REVOKED";
    expect(await getCardRegistrationPath(privateToken)).toBeNull();
  });

  it("rejects invalid QR requests without querying customer storage", async () => {
    const response = await GET(new Request("https://wallet.example.com/scan/invalid"), { params: Promise.resolve({ scanToken: "invalid" }) });
    expect(response.status).toBe(404);
    expect(mock.from).not.toHaveBeenCalled();
  });
});
