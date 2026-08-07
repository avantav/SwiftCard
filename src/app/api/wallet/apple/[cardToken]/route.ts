import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  generateAppleWalletPass,
  resolvePublicAppUrl,
} from "@/lib/wallet/apple-server";
import type { AppleWalletLocation } from "@/lib/wallet/apple";
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

function safeFilename(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${slug || "tarjeta"}-apple-wallet.pkpass`;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { cardToken } = await context.params;
  if (!cardToken || cardToken.length > 256) {
    return unavailable("La tarjeta no está disponible.", 404);
  }
  if (!walletProviderConfig("APPLE").configured) {
    return unavailable("Apple Wallet no está configurado en este entorno.", 503);
  }

  const supabase = createSupabaseAdminClient();
  const { data: card, error: cardError } = await supabase
    .from("customer_cards")
    .select("id,tenant_id,customer_id,status")
    .eq("public_token", cardToken)
    .maybeSingle();
  if (cardError || !card || card.status !== "ACTIVE") {
    return unavailable("La tarjeta no está disponible.", 404);
  }

  const [tenantResult, customerResult, designResult, balanceResult, programResult, branchesResult] =
    await Promise.all([
      supabase
        .from("tenants")
        .select("name,status,branding_mode,logo_url,banner_url")
        .eq("id", card.tenant_id)
        .maybeSingle(),
      supabase
        .from("customers")
        .select("full_name,status")
        .eq("id", card.customer_id)
        .eq("tenant_id", card.tenant_id)
        .maybeSingle(),
      supabase
        .from("tenant_wallet_designs")
        .select(
          "apple_enabled,logo_text,description,background_color,foreground_color,label_color,logo_image_url,strip_image_url,version",
        )
        .eq("tenant_id", card.tenant_id)
        .maybeSingle(),
      supabase
        .from("customer_loyalty_balances")
        .select("stamp_balance")
        .eq("customer_id", card.customer_id)
        .eq("tenant_id", card.tenant_id)
        .maybeSingle(),
      supabase
        .from("loyalty_programs")
        .select("id,name,reward_stamp_goal,terms_and_conditions,status,updated_at")
        .eq("tenant_id", card.tenant_id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("branches")
        .select("name,latitude,longitude,proximity_message")
        .eq("tenant_id", card.tenant_id)
        .eq("status", "ACTIVE")
        .eq("proximity_enabled", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(10),
    ]);

  const tenant = tenantResult.data;
  const customer = customerResult.data;
  const design = designResult.data;
  const program = programResult.data;
  if (
    tenantResult.error ||
    customerResult.error ||
    designResult.error ||
    balanceResult.error ||
    programResult.error ||
    !tenant ||
    tenant.status !== "ACTIVE" ||
    !customer ||
    customer.status !== "ACTIVE" ||
    !design?.apple_enabled ||
    !program
  ) {
    return unavailable("Apple Wallet no está habilitado para esta tarjeta.", 404);
  }

  const [{ data: tiers, error: tiersError }, { count: availableRewards, error: rewardsError }] =
    await Promise.all([
      supabase
        .from("loyalty_reward_tiers")
        .select("stamps_required,name,description")
        .eq("tenant_id", card.tenant_id)
        .eq("program_id", program.id)
        .eq("active", true)
        .order("stamps_required"),
      supabase
        .from("rewards")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", card.tenant_id)
        .eq("customer_id", card.customer_id)
        .eq("status", "AVAILABLE")
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
    ]);
  if (tiersError || rewardsError) {
    return unavailable("No se pudo preparar la tarjeta para Apple Wallet.", 500);
  }

  const locations: AppleWalletLocation[] = (branchesResult.data ?? []).flatMap(
    (branch) => {
      const latitude = Number(branch.latitude);
      const longitude = Number(branch.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      return [
        {
          latitude,
          longitude,
          relevantText:
            branch.proximity_message?.trim() || `Estás cerca de ${branch.name}.`,
        },
      ];
    },
  );
  const serialNumber = card.id;

  try {
    const publicUrl = resolvePublicAppUrl(request.url);
    const pass = await generateAppleWalletPass(
      {
        serialNumber,
        tenantName: tenant.name,
        brandingMode: tenant.branding_mode,
        logoText: design.logo_text,
        description: design.description,
        backgroundColor: design.background_color,
        foregroundColor: design.foreground_color,
        labelColor: design.label_color,
        customerName: customer.full_name,
        programName: program.name,
        stampBalance: Number(balanceResult.data?.stamp_balance ?? 0),
        rewardGoal: program.reward_stamp_goal,
        availableRewards: availableRewards ?? 0,
        termsAndConditions:
          program.terms_and_conditions ??
          "Consulta los términos y condiciones vigentes con el negocio.",
        rewardTiers: (tiers ?? []).map((tier) => ({
          stampsRequired: tier.stamps_required,
          name: tier.name,
          description: tier.description,
        })),
        cardUrl: `${publicUrl}/card/${encodeURIComponent(cardToken)}`,
        locations,
      },
      {
        logoUrl: design.logo_image_url ?? tenant.logo_url,
        stripUrl: design.strip_image_url ?? tenant.banner_url,
      },
    );

    await supabase.from("wallet_passes").upsert(
      {
        tenant_id: card.tenant_id,
        customer_id: card.customer_id,
        customer_card_id: card.id,
        provider: "APPLE",
        status: "ACTIVE",
        serial_number: serialNumber,
        external_pass_id: null,
        last_synced_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "provider,customer_card_id" },
    );

    return new NextResponse(new Uint8Array(pass), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${safeFilename(tenant.name)}"`,
        "Content-Type": "application/vnd.apple.pkpass",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    await supabase.from("wallet_passes").upsert(
      {
        tenant_id: card.tenant_id,
        customer_id: card.customer_id,
        customer_card_id: card.id,
        provider: "APPLE",
        status: "FAILED",
        serial_number: serialNumber,
        last_synced_at: null,
        last_error: "Apple Wallet pass generation failed.",
      },
      { onConflict: "provider,customer_card_id" },
    );
    return unavailable("No se pudo generar la tarjeta para Apple Wallet.", 500);
  }
}
