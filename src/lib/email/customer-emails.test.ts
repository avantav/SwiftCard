import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  claimed: new Set<string>(),
  updates: [] as Array<Record<string, unknown>>,
}));

type Row = Record<string, unknown>;
const rows: Record<string, Row | Row[]> = {
  customer_cards: {
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "t1",
    customer_id: "c1",
    loyalty_card_id: "l1",
    public_token: "a".repeat(43),
    status: "ACTIVE",
  },
  customers: { full_name: "Ana López", email: "ana@example.com", status: "ACTIVE" },
  tenants: { name: "Clarity Brew Bar", status: "ACTIVE", branding_mode: "STANDARD", logo_url: null },
  loyalty_cards: { id: "l1", program_id: "p1", status: "PUBLISHED", background_color: "#10253D", logo_image_url: null },
  customer_loyalty_balances: { stamp_balance: 1, lifetime_points_tenths: 0 },
  loyalty_programs: { name: "Club", program_type: "STAMPS_PER_PURCHASE", unit_name_singular: "sello", unit_name_plural: "sellos" },
  loyalty_reward_tiers: [{ stamps_required: 10, name: "Café gratis" }],
  rewards: { name: "Galleta de bienvenida" },
};

function query(table: string) {
  let pendingUpsert: Row | null = null;
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    select: chain, eq: chain, order: chain, limit: chain, is: chain,
    maybeSingle: async () => ({ data: Array.isArray(rows[table]) ? null : rows[table], error: null }),
    then: (resolve: (value: unknown) => unknown) => {
      if (pendingUpsert) {
        const key = String(pendingUpsert.event_key);
        const fresh = !state.claimed.has(key);
        state.claimed.add(key);
        return resolve({ data: fresh ? [{ id: `delivery-${key}` }] : [], error: null });
      }
      return resolve({ data: rows[table], error: null });
    },
    upsert: (row: Row) => { pendingUpsert = row; return builder; },
    update: (row: Row) => { state.updates.push(row); return builder; },
  });
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: (table: string) => query(table) }),
}));

import { sendWelcomeEmailBestEffort } from "./customer-emails";

describe("sendWelcomeEmailBestEffort", () => {
  const sent: Array<{ headers: Record<string, string>; body: Record<string, unknown> }> = [];

  beforeEach(() => {
    state.claimed.clear();
    state.updates.length = 0;
    sent.length = 0;
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM_ADDRESS", "tarjetas@correo.example.com");
    vi.stubEnv("SWIFTWALLET_PUBLIC_URL", "https://wallet.example.com");
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      sent.push({ headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends one welcome email with the welcome reward and records it", async () => {
    await expect(sendWelcomeEmailBestEffort("a".repeat(43))).resolves.toBe("SENT");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toMatchObject({
      from: '"Clarity Brew Bar" <tarjetas@correo.example.com>',
      to: ["ana@example.com"],
      subject: "¡Bienvenido! Tienes un regalo en Clarity Brew Bar",
    });
    expect(sent[0]?.headers["Idempotency-Key"]).toBe("welcome:11111111-1111-4111-8111-111111111111");
    expect(state.updates).toContainEqual(expect.objectContaining({ status: "SENT", provider_message_id: "email_1" }));
  });

  it("does not send the same welcome email twice", async () => {
    await sendWelcomeEmailBestEffort("a".repeat(43));
    await expect(sendWelcomeEmailBestEffort("a".repeat(43))).resolves.toBe("ALREADY_HANDLED");
    expect(sent).toHaveLength(1);
  });

  it("does nothing when the provider is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendWelcomeEmailBestEffort("a".repeat(43))).resolves.toBe("NOT_CONFIGURED");
    expect(sent).toHaveLength(0);
  });

  it("records provider failures without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 422 })));
    await expect(sendWelcomeEmailBestEffort("a".repeat(43))).resolves.toBe("FAILED");
    expect(state.updates).toContainEqual(expect.objectContaining({ status: "FAILED" }));
  });
});

describe("customer email boundaries", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

  it("keeps the provider key server-only and out of the browser", () => {
    expect(read("./resend.ts")).toContain('import "server-only"');
    expect(read("./customer-emails.ts")).toContain('import "server-only"');
    expect(read("../../../.env.example")).toContain("RESEND_API_KEY=");
    expect(read("../../../.env.example")).not.toMatch(/NEXT_PUBLIC_RESEND/);
  });

  it("sends welcome emails only for new cards and reward emails after operations", () => {
    expect(read("../../app/register/[branchToken]/actions.ts")).toContain(
      'if (result.result === "CREATED") await sendWelcomeEmailBestEffort(result.card_token);',
    );
    expect(read("../../app/app/register/actions.ts")).toContain("sendWelcomeEmailBestEffort(result.card_token)");
    expect(read("../wallet/activity-dispatch.ts")).toContain("sendRewardEmailsBestEffort(customerId)");
  });

  it("captures marketing consent only as an explicit opt-in", () => {
    expect(read("../../components/public-registration-flow.tsx")).toMatch(/name="marketingConsent" type="checkbox"(?![^>]*defaultChecked)(?![^>]*required)/);
    expect(read("../../app/app/page.tsx")).toMatch(/name="marketingConsent" type="checkbox" \/>/);
    const migration = read("../../../supabase/migrations/0070_customer_emails_and_marketing_consent.sql");
    expect(migration).toContain("add column marketing_consent boolean not null default false");
    expect(migration).toContain("revoke all on public.customer_email_deliveries from public, anon, authenticated;");
  });
});
