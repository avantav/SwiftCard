import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { consolidateDraftCards } from "@/lib/admin/cards";

const model = readFileSync(
  new URL("../../../supabase/migrations/0043_multi_card_drafts.sql", import.meta.url),
  "utf8",
);
const operations = readFileSync(
  new URL("../../../supabase/migrations/0044_card_scoped_operations.sql", import.meta.url),
  "utf8",
);
const wizard = readFileSync(
  new URL("../../app/admin/cards/[cardId]/edit/page.tsx", import.meta.url),
  "utf8",
);
const designEditor = readFileSync(
  new URL("../../components/card-design-editor.tsx", import.meta.url),
  "utf8",
);
const applePreview = readFileSync(
  new URL("../../components/apple-store-card-preview.tsx", import.meta.url),
  "utf8",
);
const cardActions = readFileSync(
  new URL("../../app/admin/cards/actions.ts", import.meta.url),
  "utf8",
);
const walletCardUpdates = readFileSync(
  new URL(
    "../../../supabase/migrations/0048_apple_wallet_card_configuration_updates.sql",
    import.meta.url,
  ),
  "utf8",
);
const lifecycle = readFileSync(
  new URL("../../../supabase/migrations/0052_admin_card_customer_lifecycle.sql", import.meta.url),
  "utf8",
);
const notificationIconMigration = readFileSync(
  new URL("../../../supabase/migrations/0058_apple_wallet_notification_icon.sql", import.meta.url),
  "utf8",
);
const imageLayoutMigration = readFileSync(
  new URL("../../../supabase/migrations/0062_wallet_image_layout_controls.sql", import.meta.url),
  "utf8",
);
const stripDimmingMigration = readFileSync(
  new URL("../../../supabase/migrations/0063_wallet_strip_dimming_option.sql", import.meta.url),
  "utf8",
);
const stripStampsMigration = readFileSync(
  new URL("../../../supabase/migrations/0064_wallet_strip_stamps_option.sql", import.meta.url),
  "utf8",
);
const optionalCardTitleMigration = readFileSync(
  new URL("../../../supabase/migrations/0065_optional_wallet_card_title.sql", import.meta.url),
  "utf8",
);

describe("multi-card loyalty boundary", () => {
  it("owns a program and limits each tenant to three durable cards", () => {
    expect(model).toContain("program_id uuid not null unique");
    expect(model).toContain("status public.loyalty_card_status not null default 'DRAFT'");
    expect(model).toContain(") >= 3 then");
    expect(model).toContain("pg_advisory_xact_lock");
    expect(model).toContain("program_completed boolean not null default false");
    expect(model).toContain("design_completed boolean not null default false");
    expect(model).toContain("locations_completed boolean not null default false");
  });

  it("keeps writes behind tenant-derived RPCs and forced RLS", () => {
    expect(model).toContain("alter table public.loyalty_cards force row level security");
    expect(model).toContain("alter table public.loyalty_card_branches force row level security");
    expect(model).toContain("sp.id = auth.uid() and sp.role = 'ADMIN'");
    expect(model).toContain("grant select on public.loyalty_cards, public.loyalty_card_branches to authenticated");
    expect(model).not.toContain("grant insert on public.loyalty_cards");
  });

  it("scopes registration and earning to the issued card and allowed branch", () => {
    expect(operations).toContain("target_loyalty_card_id uuid");
    expect(operations).toContain("target_customer_card_id uuid");
    expect(operations).toContain("assignment.branch_id = target_branch_id");
    expect(operations).toContain("function app.get_staff_registration_scopes");
    expect(operations).toContain("app.current_staff_can_access_branch(branch.id)");
    expect(operations).toContain("issued_record.loyalty_card_id, program_record.id");
    expect(operations).toContain("reward.loyalty_card_id = card.id");
  });

  it("uses resumable stages and one uploaded design for both provider previews", () => {
    expect(wizard).toContain('const steps = ["Programa", "Diseño", "Sucursales", "Publicar"]');
    expect(wizard).toContain('name="intent" value="exit"');
    expect(designEditor).toContain('setProvider("APPLE")');
    expect(designEditor).toContain('setProvider("GOOGLE")');
    expect(designEditor).toContain("APPLE_WALLET_ASSET_BUCKET");
    expect(designEditor).toContain("createAppleWalletAssetPath(tenantId");
    expect(designEditor).toContain("AppleStoreCardPreview");
    expect(designEditor).toContain("URL.createObjectURL(file)");
    expect(designEditor).toContain("localPreviews.logo || design.logoImageUrl");
    expect(designEditor).toContain('label: "Icono de notificaciones"');
    expect(designEditor).toContain('name="notificationIconUrl"');
    expect(designEditor).toContain("preventSubmitWhileUploading");
    expect(designEditor).toContain("Mostrando cambios sin guardar");
    expect(designEditor).toContain("wallet-asset-list");
    expect(designEditor).toContain("wallet-advanced-controls");
    expect(designEditor).toContain("resetImageLayout");
    expect(designEditor).toContain("El encuadre nunca mueve campos ni cambia la estructura del pase");
    expect(designEditor).toContain('name={key}');
    expect(designEditor).toContain('"logoScalePercent"');
    expect(designEditor).toContain('"stripMarginYPercent"');
    expect(designEditor).toContain("onInput=");
    expect(wizard).toContain("rewardGoal");
    expect(applePreview).toContain("appleWalletStampSlots");
    expect(applePreview).toContain("appleWalletProgressText");
    expect(applePreview).toContain("apple-pass-preview-supporting-fields");
  });

  it("queues and immediately dispatches installed pass updates after card edits", () => {
    expect(walletCardUpdates).toContain("queue_apple_wallet_card_updates");
    expect(walletCardUpdates).toContain("apple_wallet_loyalty_card_changed");
    expect(walletCardUpdates).toContain("apple_wallet_loyalty_card_branch_changed");
    expect(walletCardUpdates).toContain("issued.loyalty_card_id = target_loyalty_card_id");
    expect(notificationIconMigration).toContain("notification_icon_url");
    expect(notificationIconMigration).toContain("save_loyalty_card_design_v2");
    expect(notificationIconMigration).toContain("apple_wallet_loyalty_card_changed");
    expect(imageLayoutMigration).toContain("save_loyalty_card_design_v3");
    expect(imageLayoutMigration).toContain("logo_scale_percent");
    expect(imageLayoutMigration).toContain("strip_margin_y_percent");
    expect(stripDimmingMigration).toContain("save_loyalty_card_design_v4");
    expect(stripDimmingMigration).toContain("strip_dimming_enabled");
    expect(wizard).toContain("strip_dimming_enabled: true, strip_stamps_enabled: true");
    expect(stripStampsMigration).toContain("save_loyalty_card_design_v5");
    expect(stripStampsMigration).toContain("strip_stamps_enabled");
    expect(designEditor).toContain("Mostrar sellos sobre la imagen");
    expect(cardActions).toContain("target_strip_stamps_enabled");
    expect(designEditor).toContain("Nombre en la tarjeta (opcional)");
    expect(optionalCardTitleMigration).toContain("length(btrim(target_logo_text)) > 60");
    expect(cardActions).toContain("tenantAppleWalletAssetPath");
    expect(cardActions).toContain("notification_icon_url");
    expect(cardActions.match(/dispatchAppleWalletUpdatesBestEffort/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("consolidates same-name drafts and protects lifecycle operations with tenant Admin RPCs", () => {
    const cards = consolidateDraftCards([
      { id: "step-1", name: "Café diario", status: "DRAFT", current_step: 1, updated_at: "2026-01-03" },
      { id: "step-3", name: " café DIARIO ", status: "DRAFT", current_step: 3, updated_at: "2026-01-01" },
      { id: "step-3-complete", name: "CAFÉ DIARIO", status: "DRAFT", current_step: 3, updated_at: "2025-12-01", program_completed: true, design_completed: true, locations_completed: true },
      { id: "published", name: "Café diario", status: "PUBLISHED", current_step: 4, updated_at: "2026-01-02" },
    ]);
    expect(cards.map((card) => card.id)).toEqual(["step-3-complete", "published"]);
    expect(lifecycle).toContain("loyalty_cards_tenant_draft_name_unique_idx");
    expect(lifecycle).toContain("and sp.role = 'ADMIN'");
    expect(lifecycle).toContain("function app.archive_loyalty_card");
    expect(lifecycle).toContain("function app.restore_loyalty_card");
    expect(lifecycle).toContain("function app.delete_archived_loyalty_card");
    expect(lifecycle).toContain("return 'HAS_HISTORY'");
  });
});
