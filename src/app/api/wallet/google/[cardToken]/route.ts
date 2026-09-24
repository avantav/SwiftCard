import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadGoogleWalletPassSource } from "@/lib/wallet/google-pass-source";
import { syncGoogleWalletPass } from "@/lib/wallet/google-server";
import { walletProviderConfig } from "@/lib/wallet/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ cardToken: string }> };

function unavailable(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { cardToken } = await context.params;
  if (!cardToken || cardToken.length > 256) {
    return unavailable("La tarjeta no está disponible.", 404);
  }
  if (!walletProviderConfig("GOOGLE").configured) {
    return unavailable("Google Wallet no está configurado en este entorno.", 503);
  }

  const loaded = await loadGoogleWalletPassSource(cardToken, request.url);
  if (!loaded.ok) return unavailable(loaded.message, loaded.status);
  const { source } = loaded;
  const supabase = createSupabaseAdminClient();
  const { data: termsAccepted, error: termsError } = await supabase
    .schema("app")
    .rpc("public_card_terms_are_accepted", { target_card_token: cardToken });
  if (termsError) {
    console.error("Unable to verify Google Wallet card terms acceptance.");
    return unavailable(
      "No se pudo verificar la aceptación de los términos. Intenta nuevamente.",
      503,
    );
  }
  if (termsAccepted !== true) {
    return unavailable(
      "Debes aceptar los términos y condiciones antes de agregar la tarjeta.",
      403,
    );
  }

  try {
    const result = await syncGoogleWalletPass(source.passData);
    const { error: passRecordError } = await supabase.from("wallet_passes").upsert(
      {
        tenant_id: source.tenantId,
        customer_id: source.customerId,
        customer_card_id: source.customerCardId,
        provider: "GOOGLE",
        status: "ACTIVE",
        serial_number: result.objectId,
        external_pass_id: result.objectId,
        last_synced_at: new Date().toISOString(),
        update_pending_at: null,
        last_error: null,
      },
      { onConflict: "provider,customer_card_id" },
    );
    if (passRecordError) throw passRecordError;

    const response = NextResponse.redirect(result.saveUrl, 302);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    console.error(
      "Unable to synchronize Google Wallet pass.",
      error instanceof Error ? error.message : "Unknown error.",
    );
    await supabase.from("wallet_passes").upsert(
      {
        tenant_id: source.tenantId,
        customer_id: source.customerId,
        customer_card_id: source.customerCardId,
        provider: "GOOGLE",
        status: "FAILED",
        serial_number: `google_${source.customerCardId.replaceAll("-", "")}`,
        external_pass_id: null,
        last_synced_at: null,
        update_pending_at: null,
        last_error: "Google Wallet pass generation failed.",
      },
      { onConflict: "provider,customer_card_id" },
    );
    return unavailable(
      "No se pudo preparar la tarjeta para Google Wallet.",
      502,
    );
  }
}
