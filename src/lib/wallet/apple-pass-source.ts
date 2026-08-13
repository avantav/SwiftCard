import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AppleWalletLocation, AppleWalletPassData } from "./apple";
import {
  getApplePassAuthenticationToken,
  resolvePublicAppUrl,
} from "./apple-server";

type AppleWalletPassLookup =
  | { cardToken: string; serialNumber?: never; allowInactive: false }
  | { serialNumber: string; cardToken?: never; allowInactive: true };

export type AppleWalletPassSource = {
  walletPassId: string | null;
  tenantId: string;
  customerId: string;
  customerCardId: string;
  cardToken: string;
  tenantName: string;
  updateTag: string | null;
  lastModified: Date | null;
  passData: AppleWalletPassData;
  assets: { logoUrl: string | null; stripUrl: string | null };
};

export type AppleWalletPassSourceResult =
  | { ok: true; source: AppleWalletPassSource }
  | { ok: false; status: 404 | 500; message: string };

export function safeAppleWalletFilename(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${slug || "tarjeta"}-apple-wallet.pkpass`;
}

export async function loadAppleWalletPassSource(
  lookup: AppleWalletPassLookup,
  requestUrl: string,
): Promise<AppleWalletPassSourceResult> {
  const supabase = createSupabaseAdminClient();
  let walletPass: {
    id: string;
    tenant_id: string;
    customer_id: string;
    customer_card_id: string;
    serial_number: string;
    status: string;
    update_tag: number | string;
    updated_at: string;
  } | null = null;

  if (lookup.serialNumber) {
    const { data, error } = await supabase
      .from("wallet_passes")
      .select(
        "id,tenant_id,customer_id,customer_card_id,serial_number,status,update_tag,updated_at",
      )
      .eq("provider", "APPLE")
      .eq("serial_number", lookup.serialNumber)
      .maybeSingle();
    if (error || !data || data.status === "REVOKED") {
      return { ok: false, status: 404, message: "La tarjeta no está disponible." };
    }
    walletPass = data;
  }

  const cardQuery = supabase
    .from("customer_cards")
    .select("id,tenant_id,customer_id,public_token,status");
  const { data: card, error: cardError } = walletPass
    ? await cardQuery.eq("id", walletPass.customer_card_id).maybeSingle()
    : await cardQuery.eq("public_token", lookup.cardToken).maybeSingle();

  if (cardError || !card) {
    return { ok: false, status: 404, message: "La tarjeta no está disponible." };
  }

  const [
    tenantResult,
    customerResult,
    designResult,
    balanceResult,
    programResult,
    branchesResult,
  ] = await Promise.all([
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
      .select("id,name,program_type,reward_stamp_goal,terms_and_conditions,status,updated_at")
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
    branchesResult.error ||
    !tenant ||
    !customer ||
    !design ||
    !program
  ) {
    return {
      ok: false,
      status: tenant || customer || design || program ? 500 : 404,
      message: "No se pudo preparar la tarjeta para Apple Wallet.",
    };
  }

  if (
    !lookup.allowInactive &&
    (tenant.status !== "ACTIVE" ||
      customer.status !== "ACTIVE" ||
      card.status !== "ACTIVE" ||
      !design.apple_enabled)
  ) {
    return {
      ok: false,
      status: 404,
      message: "Apple Wallet no está habilitado para esta tarjeta.",
    };
  }

  const [tiersResult, rewardsResult] = await Promise.all([
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
  if (tiersResult.error || rewardsResult.error) {
    return {
      ok: false,
      status: 500,
      message: "No se pudo preparar la tarjeta para Apple Wallet.",
    };
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
  const serialNumber = walletPass?.serial_number ?? card.id;
  const publicUrl = resolvePublicAppUrl(requestUrl);

  return {
    ok: true,
    source: {
      walletPassId: walletPass?.id ?? null,
      tenantId: card.tenant_id,
      customerId: card.customer_id,
      customerCardId: card.id,
      cardToken: card.public_token,
      tenantName: tenant.name,
      updateTag: walletPass ? String(walletPass.update_tag) : null,
      lastModified: walletPass ? new Date(walletPass.updated_at) : null,
      passData: {
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
        programType: program.program_type,
        stampBalance: Number(balanceResult.data?.stamp_balance ?? 0),
        rewardGoal: program.reward_stamp_goal,
        availableRewards: rewardsResult.count ?? 0,
        termsAndConditions:
          program.terms_and_conditions ??
          "Consulta los términos y condiciones vigentes con el negocio.",
        rewardTiers: (tiersResult.data ?? []).map((tier) => ({
          stampsRequired: tier.stamps_required,
          name: tier.name,
          description: tier.description,
        })),
        cardUrl: `${publicUrl}/card/${encodeURIComponent(card.public_token)}`,
        webServiceUrl: `${publicUrl}/api/wallet/apple`,
        authenticationToken: getApplePassAuthenticationToken(serialNumber),
        voided:
          lookup.allowInactive &&
          (tenant.status !== "ACTIVE" ||
            customer.status !== "ACTIVE" ||
            card.status !== "ACTIVE" ||
            !design.apple_enabled),
        locations,
      },
      assets: {
        logoUrl: design.logo_image_url ?? tenant.logo_url,
        stripUrl: design.strip_image_url ?? tenant.banner_url,
      },
    },
  };
}
