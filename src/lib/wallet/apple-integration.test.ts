import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/0036_apple_wallet_tenant_designs.sql", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../../app/api/wallet/apple/[cardToken]/route.ts", import.meta.url),
  "utf8",
);
const adminAction = readFileSync(
  new URL("../../app/admin/wallet/actions.ts", import.meta.url),
  "utf8",
);
const publicCard = readFileSync(
  new URL("../../components/public-wallet-card.tsx", import.meta.url),
  "utf8",
);
const appleServer = readFileSync(
  new URL("./apple-server.ts", import.meta.url),
  "utf8",
);

describe("Apple Wallet integration boundaries", () => {
  it("keeps design mutation behind an Admin-only audited RPC", () => {
    expect(migration).toContain("function app.save_apple_wallet_design");
    expect(migration).toContain("sp.role = 'ADMIN'");
    expect(migration).toContain("APPLE_WALLET_DESIGN_UPDATED");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("revoke all on public.tenant_wallet_designs");
    expect(adminAction).toContain('context.access.role !== "ADMIN"');
    expect(adminAction).toContain('.schema("app")');
  });

  it("derives pass ownership from the public card token on the server", () => {
    expect(route).toContain('.eq("public_token", cardToken)');
    expect(route).toContain("createSupabaseAdminClient");
    expect(route).toContain('tenant.status !== "ACTIVE"');
    expect(route).toContain('customer.status !== "ACTIVE"');
    expect(route).toContain("application/vnd.apple.pkpass");
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route).not.toContain("tenantId = request");
    expect(appleServer).toContain('pass.type = "storeCard"');
    expect(appleServer).toContain("pass.primaryFields.push");
    expect(appleServer).toContain("APPLE_WALLET_ASSET_HOSTS");
    expect(appleServer).toContain("MAX_REMOTE_IMAGE_BYTES");
  });

  it("only exposes the public download when the server and tenant are ready", () => {
    expect(migration).toContain("public_apple_wallet_is_enabled");
    expect(publicCard).toContain("appleWalletAvailable && cardToken");
    expect(publicCard).toContain("/api/wallet/apple/");
  });
});
