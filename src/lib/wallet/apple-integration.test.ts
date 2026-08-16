import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/0036_apple_wallet_tenant_designs.sql", import.meta.url),
  "utf8",
);
const storageMigration = readFileSync(
  new URL(
    "../../../supabase/migrations/0037_apple_wallet_storage_assets.sql",
    import.meta.url,
  ),
  "utf8",
);
const route = readFileSync(
  new URL("../../app/api/wallet/apple/[cardToken]/route.ts", import.meta.url),
  "utf8",
);
const source = readFileSync(new URL("./apple-pass-source.ts", import.meta.url), "utf8");
const updateMigration = readFileSync(
  new URL(
    "../../../supabase/migrations/0038_apple_wallet_updates.sql",
    import.meta.url,
  ),
  "utf8",
);
const serviceSequenceMigration = readFileSync(
  new URL(
    "../../../supabase/migrations/0039_apple_wallet_service_sequence.sql",
    import.meta.url,
  ),
  "utf8",
);
const registrationRoute = readFileSync(
  new URL(
    "../../app/api/wallet/apple/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/[serialNumber]/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const updatedPassRoute = readFileSync(
  new URL(
    "../../app/api/wallet/apple/v1/passes/[passTypeIdentifier]/[serialNumber]/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const apns = readFileSync(new URL("./apple-apns.ts", import.meta.url), "utf8");
const webService = readFileSync(
  new URL("./apple-web-service.ts", import.meta.url),
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
const walletForm = readFileSync(
  new URL("../../components/apple-wallet-design-form.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
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
    expect(route).toContain("loadAppleWalletPassSource");
    expect(source).toContain('.eq("public_token", lookup.cardToken)');
    expect(route).toContain("createSupabaseAdminClient");
    expect(source).toContain('tenant.status !== "ACTIVE"');
    expect(source).toContain('customer.status !== "ACTIVE"');
    expect(route).toContain("application/vnd.apple.pkpass");
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route).not.toContain("tenantId = request");
    expect(appleServer).toContain('pass.type = "storeCard"');
    expect(appleServer).toContain("pass.setBarcodes(...barcodes)");
    expect(appleServer).toContain("pass.setLocations(...locations)");
    expect(appleServer).toContain("pass.primaryFields.push");
    expect(appleServer).toContain("APPLE_WALLET_ASSET_HOSTS");
    expect(appleServer).toContain("MAX_REMOTE_IMAGE_BYTES");
  });

  it("implements the complete PassKit update web service and durable outbox", () => {
    expect(updateMigration).toContain("create table public.apple_wallet_devices");
    expect(updateMigration).toContain("create table public.apple_wallet_registrations");
    expect(updateMigration).toContain("create table public.apple_wallet_update_outbox");
    expect(updateMigration).toContain("force row level security");
    expect(updateMigration).toContain("queue_apple_wallet_customer_updates");
    expect(updateMigration).toContain("claim_apple_wallet_updates");
    expect(registrationRoute).toContain("registerAppleWalletDevice");
    expect(webService).toContain("applePassAuthorizationMatches");
    expect(updatedPassRoute).toContain("application/vnd.apple.pkpass");
    expect(updatedPassRoute).toContain("If-Modified-Since".toLowerCase());
    expect(source).toContain("webServiceUrl");
    expect(source).toContain("authenticationToken");
    expect(apns).toContain("api.push.apple.com");
    expect(apns).toContain('"apns-push-type": "background"');
    expect(apns).toContain('const payload = "{}"');
  });

  it("lets only the server role allocate update tags during pass issuance", () => {
    expect(serviceSequenceMigration).toContain("grant usage, select");
    expect(serviceSequenceMigration).toContain("apple_wallet_update_tag_seq");
    expect(serviceSequenceMigration).toContain("to service_role");
    expect(serviceSequenceMigration).not.toMatch(/to\s+(anon|authenticated)/);
  });

  it("only exposes the public download when the server and tenant are ready", () => {
    expect(migration).toContain("public_apple_wallet_is_enabled");
    expect(publicCard).toContain("appleWalletAvailable && cardToken");
    expect(publicCard).toContain("?claim=1");
  });

  it("uploads tenant images to an RLS-scoped Supabase Storage bucket", () => {
    expect(storageMigration).toContain("'wallet-assets'");
    expect(storageMigration).toContain("file_size_limit");
    expect(storageMigration).toContain("wallet_assets_admin_insert");
    expect(storageMigration).toContain("app.current_staff_tenant_id()::text");
    expect(storageMigration).toContain("app.current_staff_can_manage_tenant");
    expect(walletForm).toContain("createSupabaseBrowserClient");
    expect(walletForm).toContain(".upload(path, file");
    expect(walletForm).toContain('type="file"');
    expect(walletForm).not.toContain('placeholder="https://');
    expect(appleServer).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("keeps the visual preview aligned with Apple's store-card layout", () => {
    expect(appleServer).toContain("buildAppleWalletStampStrips");
    expect(appleServer).toContain("stampBalance: input.stampBalance");
    expect(appleServer).toContain('input.programType === "LIFETIME_POINTS"');
    expect(walletForm).toContain("apple-pass-preview-primary");
    expect(walletForm).toContain("apple-pass-preview-stamps");
    expect(walletForm).toContain("apple-pass-preview-supporting-fields");
    expect(walletForm).toContain("/icons/wallet-preview-qr.svg");
    expect(styles).toContain("aspect-ratio: 375 / 144");
    expect(styles).toMatch(
      /font-family:\s*-apple-system, BlinkMacSystemFont, "SF Pro Text"/,
    );
  });
});
