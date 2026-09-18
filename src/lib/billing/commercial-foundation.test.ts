import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/0059_commercial_billing_foundation.sql",
    import.meta.url
  ),
  "utf8"
);

describe("commercial billing foundation", () => {
  it("persists the complete provider-neutral commercial domain", () => {
    for (const table of [
      "billing_packages",
      "billing_package_prices",
      "billing_customers",
      "tenant_subscriptions",
      "billing_membership_usage",
      "billing_promotions",
      "billing_promotion_packages",
      "billing_promotion_redemptions",
      "billing_affiliates",
      "billing_affiliate_referrals",
      "billing_affiliate_commissions",
      "stripe_webhook_events"
    ]) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} force row level security`
      );
    }
  });

  it("derives current and peak membership use on the database boundary", () => {
    expect(migration).toContain(
      "function app.current_billable_memberships(target_tenant_id uuid)"
    );
    expect(migration).toContain(
      "function app.capture_membership_usage(target_tenant_id uuid)"
    );
    expect(migration).toContain("greatest(");
    expect(migration).toContain("customer_cards_capture_billing_usage");
    expect(migration).toContain("customers_capture_billing_usage");
    expect(migration).toContain("subscriptions_initialize_billing_usage");
  });

  it("keeps Stripe events and usage authority outside browser roles", () => {
    expect(migration).toContain(
      "revoke all on public.stripe_webhook_events from authenticated"
    );
    expect(migration).toContain(
      "revoke all on function app.current_billable_memberships(uuid) from public, anon, authenticated"
    );
    expect(migration).toContain(
      "revoke all on function app.capture_membership_usage(uuid) from public, anon, authenticated"
    );
  });

  it("uses snapshots and non-destructive catalog states", () => {
    expect(migration).toContain(
      "create type public.billing_catalog_status as enum ('DRAFT', 'ACTIVE', 'ARCHIVED')"
    );
    expect(migration).toContain("package_name_snapshot");
    expect(migration).toContain("membership_limit_snapshot");
    expect(migration).toContain("promotion_code_snapshot");
    expect(migration).not.toContain("on delete cascade");
  });

  it("creates and archives package plus price through Superadmin-only RPCs", () => {
    expect(migration).toContain("function app.create_billing_package(");
    expect(migration).toContain("function app.set_billing_package_status(");
    expect(migration).toContain("if not app.is_superadmin()");
    expect(migration).toContain("target_status = 'DRAFT'");
    expect(migration).toContain("where package_id = target_package_id");
  });
});
