import { readFileSync } from "node:fs";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { stripeCheckoutConfig } from "./stripe";
import { mapSubscriptionStatus, processStripeEvent, type WebhookDeps } from "./stripe-webhook";

type Row = Record<string, unknown>;

function fakeDb(initial: { events?: Row[]; customers?: Row[]; prices?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    stripe_webhook_events: initial.events ?? [],
    billing_customers: initial.customers ?? [],
    billing_package_prices: initial.prices ?? [{ id: "local-price", stripe_price_id: "price_123" }],
  };
  const rpc = vi.fn(async (name: string, args: Row) => {
    if (name === "provision_self_service_tenant") {
      tables.billing_customers.push({ tenant_id: "tenant-1", stripe_customer_id: args.target_stripe_customer_id });
      return { data: "tenant-1", error: null };
    }
    return { data: "sub-local", error: null };
  });
  function from(table: string) {
    const filters: Array<[string, unknown]> = [];
    let pendingUpdate: Row | null = null;
    let pendingInsert: Row | null = null;
    const rows = () => tables[table]!.filter((row) => filters.every(([key, value]) => row[key] === value));
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: () => builder,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      single: async () => {
        if (pendingInsert) {
          const row = { id: `row-${tables[table]!.length + 1}`, processing_status: "PENDING", ...pendingInsert };
          tables[table]!.push(row);
          return { data: row, error: null };
        }
        return { data: rows()[0] ?? null, error: null };
      },
      insert: (row: Row) => { pendingInsert = row; return builder; },
      update: (row: Row) => { pendingUpdate = row; return builder; },
      then: (resolve: (value: unknown) => unknown) => {
        if (pendingUpdate) for (const row of rows()) Object.assign(row, pendingUpdate);
        return resolve({ data: null, error: null });
      },
    });
    return builder;
  }
  return { tables, rpc, db: { from, schema: () => ({ rpc }) } as unknown as WebhookDeps["db"] };
}

const subscription = {
  id: "sub_123",
  status: "trialing",
  customer: "cus_123",
  metadata: { morrow_signup_intent_id: "11111111-1111-4111-8111-111111111111", morrow_package_price_id: "local-price" },
  items: { data: [{ price: { id: "price_123" }, current_period_start: 1_760_000_000, current_period_end: 1_762_592_000 }] },
  start_date: 1_760_000_000,
  trial_end: 1_762_592_000,
  cancel_at_period_end: false,
  canceled_at: null,
  ended_at: null,
  latest_invoice: "in_123",
} as unknown as Stripe.Subscription;

function event(type: string, object: unknown, id = "evt_1") {
  return { id, type, api_version: "2025-10-29", livemode: false, data: { object } } as unknown as Stripe.Event;
}

describe("processStripeEvent", () => {
  let fake: ReturnType<typeof fakeDb>;
  let deps: WebhookDeps;

  beforeEach(() => {
    fake = fakeDb();
    deps = { db: fake.db, retrieveSubscription: vi.fn(async () => subscription) };
  });

  it("provisions the tenant from a completed checkout and mirrors the subscription", async () => {
    const session = { mode: "subscription", customer: "cus_123", subscription: "sub_123", client_reference_id: "11111111-1111-4111-8111-111111111111", metadata: {} };
    await expect(processStripeEvent(event("checkout.session.completed", session), "{}", deps)).resolves.toBe("PROCESSED");
    expect(fake.rpc).toHaveBeenCalledWith("provision_self_service_tenant", {
      target_intent_id: "11111111-1111-4111-8111-111111111111",
      target_stripe_customer_id: "cus_123",
    });
    expect(fake.rpc).toHaveBeenCalledWith("sync_stripe_subscription", expect.objectContaining({
      target_tenant_id: "tenant-1",
      target_package_price_id: "local-price",
      target_stripe_subscription_id: "sub_123",
      target_status: "TRIALING",
      target_trial_ends_at: new Date(1_762_592_000 * 1000).toISOString(),
    }));
    expect(fake.tables.stripe_webhook_events[0]).toMatchObject({ stripe_event_id: "evt_1", processing_status: "PROCESSED" });
  });

  it("acknowledges an already processed event without repeating side effects", async () => {
    fake = fakeDb({ events: [{ id: "row-1", stripe_event_id: "evt_1", processing_status: "PROCESSED", attempt_count: 1 }] });
    deps = { db: fake.db, retrieveSubscription: vi.fn(async () => subscription) };
    await expect(processStripeEvent(event("customer.subscription.updated", subscription), "{}", deps)).resolves.toBe("DUPLICATE");
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("re-reads subscriptions so out-of-order events apply the latest state", async () => {
    fake = fakeDb({ customers: [{ tenant_id: "tenant-9", stripe_customer_id: "cus_123" }] });
    deps = { db: fake.db, retrieveSubscription: vi.fn(async () => ({ ...subscription, status: "past_due" }) as Stripe.Subscription) };
    await processStripeEvent(event("customer.subscription.updated", { ...subscription, status: "active" }), "{}", deps);
    expect(deps.retrieveSubscription).toHaveBeenCalledWith("sub_123");
    expect(fake.rpc).toHaveBeenCalledWith("sync_stripe_subscription", expect.objectContaining({ target_tenant_id: "tenant-9", target_status: "PAST_DUE" }));
    expect(fake.rpc).not.toHaveBeenCalledWith("provision_self_service_tenant", expect.anything());
  });

  it("ignores unrelated events and invoices without a subscription", async () => {
    await expect(processStripeEvent(event("charge.refunded", {}, "evt_2"), "{}", deps)).resolves.toBe("IGNORED");
    await expect(processStripeEvent(event("invoice.paid", { id: "in_9", parent: null }, "evt_3"), "{}", deps)).resolves.toBe("IGNORED");
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("marks the event as failed and rethrows so Stripe retries", async () => {
    const unknown = { ...subscription, metadata: {}, customer: "cus_unknown" } as unknown as Stripe.Subscription;
    deps = { db: fake.db, retrieveSubscription: vi.fn(async () => unknown) };
    await expect(processStripeEvent(event("customer.subscription.updated", unknown, "evt_4"), "{}", deps)).rejects.toThrow("tenant_not_found");
    expect(fake.tables.stripe_webhook_events.at(-1)).toMatchObject({ processing_status: "FAILED", last_error_code: "tenant_not_found" });
  });

  it("maps every Stripe status to the local subscription status", () => {
    expect(mapSubscriptionStatus("trialing")).toBe("TRIALING");
    expect(mapSubscriptionStatus("active")).toBe("ACTIVE");
    expect(mapSubscriptionStatus("unpaid")).toBe("PAST_DUE");
    expect(mapSubscriptionStatus("incomplete_expired")).toBe("CANCELED");
    expect(mapSubscriptionStatus("paused")).toBe("PAUSED");
  });
});

describe("Stripe configuration and boundaries", () => {
  it("enables checkout only with a valid key, IVA tax rate and public origin", () => {
    const valid = { STRIPE_SECRET_KEY: "sk_test_abc123", STRIPE_IVA_TAX_RATE_ID: "txr_123", SWIFTWALLET_PUBLIC_URL: "https://wallet.example.com", STRIPE_WEBHOOK_SECRET: "whsec_x" };
    expect(stripeCheckoutConfig(valid)).toMatchObject({ publicOrigin: "https://wallet.example.com", webhookSecret: "whsec_x" });
    expect(stripeCheckoutConfig({ ...valid, STRIPE_IVA_TAX_RATE_ID: "" })).toBeNull();
    expect(stripeCheckoutConfig({ ...valid, STRIPE_SECRET_KEY: "pk_test_abc" })).toBeNull();
  });

  it("keeps Stripe secrets server-side and verifies webhook signatures on the raw body", () => {
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
    expect(read("./stripe.ts")).toContain('import "server-only"');
    const route = read("../../app/api/stripe/webhook/route.ts");
    expect(route).toContain("await request.text()");
    expect(route).toContain("stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret)");
    expect(read("../../../.env.example")).not.toMatch(/NEXT_PUBLIC_STRIPE_SECRET/);
    const checkout = read("./self-service-signup.ts");
    expect(checkout).toContain("trial_period_days: SELF_SERVICE_TRIAL_DAYS");
    expect(checkout).toContain('payment_method_collection: "always"');
    expect(checkout).toContain("default_tax_rates: [config.ivaTaxRateId]");
  });
});
