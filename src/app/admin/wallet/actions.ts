"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { getRequiredPublicSupabaseConfig } from "@/lib/supabase/config";
import {
  APPLE_WALLET_ASSET_BUCKET,
  tenantAppleWalletAssetPath,
  type AppleWalletAssetKind,
} from "@/lib/wallet/assets";
import { validateAppleWalletDesignForm } from "@/lib/wallet/design";
import { dispatchAppleWalletUpdatesBestEffort } from "@/lib/wallet/apple-apns";

function redirectWithError(error: string): never {
  redirect(`/admin/wallet?error=${encodeURIComponent(error)}`);
}

export async function saveAppleWalletDesign(formData: FormData) {
  const context = await requireInternalArea("ADMIN");
  if (context.access.role !== "ADMIN" || !context.tenantId) {
    redirectWithError("Solo el Admin general puede diseñar la tarjeta de Wallet.");
  }

  const { url: supabaseUrl } = getRequiredPublicSupabaseConfig();
  const { data: currentDesign, error: currentDesignError } = await context.supabase
    .from("tenant_wallet_designs")
    .select("logo_image_url,strip_image_url")
    .eq("tenant_id", context.tenantId)
    .maybeSingle();
  if (currentDesignError) {
    redirectWithError("No se pudo verificar la configuración actual de imágenes.");
  }

  async function removeNewSubmittedAssets(values: Array<{
    kind: AppleWalletAssetKind;
    value: string | null;
    currentValue: string | null | undefined;
  }>) {
    const paths = values
      .filter(({ value, currentValue }) => value && value !== currentValue)
      .map(({ kind, value }) =>
        tenantAppleWalletAssetPath(
          value!,
          supabaseUrl,
          context.tenantId!,
          kind,
        ),
      )
      .filter((path): path is string => Boolean(path));
    if (paths.length) {
      await context.supabase.storage
        .from(APPLE_WALLET_ASSET_BUCKET)
        .remove(paths);
    }
  }

  const validation = validateAppleWalletDesignForm(formData);
  if (!validation.ok) {
    const rawLogo = formData.get("logoImageUrl");
    const rawStrip = formData.get("stripImageUrl");
    await removeNewSubmittedAssets([
      {
        kind: "logo",
        value: typeof rawLogo === "string" ? rawLogo : null,
        currentValue: currentDesign?.logo_image_url,
      },
      {
        kind: "strip",
        value: typeof rawStrip === "string" ? rawStrip : null,
        currentValue: currentDesign?.strip_image_url,
      },
    ]);
    redirectWithError(validation.errors[0] ?? "El diseño no es válido.");
  }
  const input = validation.data;

  function validateAsset(
    value: string | null,
    currentValue: string | null | undefined,
    kind: AppleWalletAssetKind,
  ) {
    if (!value || value === currentValue) return null;
    const path = tenantAppleWalletAssetPath(
      value,
      supabaseUrl,
      context.tenantId!,
      kind,
    );
    if (!path) {
      redirectWithError(
        "Las imágenes nuevas deben cargarse desde el almacenamiento de SwiftWallet.",
      );
    }
    return path;
  }

  validateAsset(
    input.logoImageUrl,
    currentDesign?.logo_image_url,
    "logo",
  );
  validateAsset(
    input.stripImageUrl,
    currentDesign?.strip_image_url,
    "strip",
  );
  const { data, error } = await context.supabase
    .schema("app")
    .rpc("save_apple_wallet_design", {
      target_apple_enabled: input.appleEnabled,
      target_logo_text: input.logoText,
      target_description: input.description,
      target_background_color: input.backgroundColor,
      target_foreground_color: input.foregroundColor,
      target_label_color: input.labelColor,
      target_logo_image_url: input.logoImageUrl ?? "",
      target_strip_image_url: input.stripImageUrl ?? "",
    });
  const result = Array.isArray(data) ? data[0]?.result : null;
  if (error || result !== "SAVED") {
    await removeNewSubmittedAssets([
      {
        kind: "logo",
        value: input.logoImageUrl,
        currentValue: currentDesign?.logo_image_url,
      },
      {
        kind: "strip",
        value: input.stripImageUrl,
        currentValue: currentDesign?.strip_image_url,
      },
    ]);
    redirectWithError("No se pudo guardar el diseño de Apple Wallet.");
  }

  const previousPaths = [
    currentDesign?.logo_image_url &&
    currentDesign.logo_image_url !== input.logoImageUrl
      ? tenantAppleWalletAssetPath(
          currentDesign.logo_image_url,
          supabaseUrl,
          context.tenantId,
          "logo",
        )
      : null,
    currentDesign?.strip_image_url &&
    currentDesign.strip_image_url !== input.stripImageUrl
      ? tenantAppleWalletAssetPath(
          currentDesign.strip_image_url,
          supabaseUrl,
          context.tenantId,
          "strip",
        )
      : null,
  ].filter((path): path is string => Boolean(path));
  if (previousPaths.length) {
    await context.supabase.storage
      .from(APPLE_WALLET_ASSET_BUCKET)
      .remove(previousPaths);
  }
  await dispatchAppleWalletUpdatesBestEffort({
    limit: 25,
    tenantId: context.tenantId,
  });
  redirect("/admin/wallet?saved=1");
}
