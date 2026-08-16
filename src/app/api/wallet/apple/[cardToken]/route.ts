import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateAppleWalletPass } from "@/lib/wallet/apple-server";
import {
  loadAppleWalletPassSource,
  safeAppleWalletFilename,
} from "@/lib/wallet/apple-pass-source";
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
  if (!walletProviderConfig("APPLE").configured) {
    return unavailable("Apple Wallet no está configurado en este entorno.", 503);
  }

  const loaded = await loadAppleWalletPassSource(
    { cardToken, allowInactive: false },
    request.url,
  );
  if (!loaded.ok) return unavailable(loaded.message, loaded.status);
  const { source } = loaded;
  const supabase = createSupabaseAdminClient();
  const { data: termsAccepted, error: termsError } = await supabase
    .schema("app")
    .rpc("public_card_terms_are_accepted", { target_card_token: cardToken });
  if (termsError || termsAccepted !== true) {
    return unavailable("Debes aceptar los términos y condiciones antes de agregar la tarjeta.", 403);
  }

  try {
    const pass = await generateAppleWalletPass(source.passData, source.assets);
    const { error: passRecordError } = await supabase.from("wallet_passes").upsert(
      {
        tenant_id: source.tenantId,
        customer_id: source.customerId,
        customer_card_id: source.customerCardId,
        provider: "APPLE",
        status: "ACTIVE",
        serial_number: source.passData.serialNumber,
        external_pass_id: null,
        last_synced_at: new Date().toISOString(),
        update_pending_at: null,
        last_error: null,
      },
      { onConflict: "provider,customer_card_id" },
    );
    if (passRecordError) throw passRecordError;

    return new NextResponse(new Uint8Array(pass), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${safeAppleWalletFilename(source.tenantName)}"`,
        "Content-Type": "application/vnd.apple.pkpass",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    await supabase.from("wallet_passes").upsert(
      {
        tenant_id: source.tenantId,
        customer_id: source.customerId,
        customer_card_id: source.customerCardId,
        provider: "APPLE",
        status: "FAILED",
        serial_number: source.passData.serialNumber,
        last_synced_at: null,
        last_error: "Apple Wallet pass generation failed.",
      },
      { onConflict: "provider,customer_card_id" },
    );
    return unavailable("No se pudo generar la tarjeta para Apple Wallet.", 500);
  }
}
