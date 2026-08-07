"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { validateAppleWalletDesignForm } from "@/lib/wallet/design";

function redirectWithError(error: string): never {
  redirect(`/admin/wallet?error=${encodeURIComponent(error)}`);
}

export async function saveAppleWalletDesign(formData: FormData) {
  const context = await requireInternalArea("ADMIN");
  if (context.access.role !== "ADMIN" || !context.tenantId) {
    redirectWithError("Solo el Admin general puede diseñar la tarjeta de Wallet.");
  }

  const validation = validateAppleWalletDesignForm(formData);
  if (!validation.ok) {
    redirectWithError(validation.errors[0] ?? "El diseño no es válido.");
  }
  const input = validation.data;
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
    redirectWithError("No se pudo guardar el diseño de Apple Wallet.");
  }
  redirect("/admin/wallet?saved=1");
}
