import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePublicOrigin } from "@/lib/public-origin";
import type { GoogleWalletPassData } from "./google";

export type GoogleWalletPassSource = {
  tenantId: string;
  customerId: string;
  customerCardId: string;
  loyaltyCardId: string;
  tenantName: string;
  passData: Omit<GoogleWalletPassData, "issuerId">;
};

export type GoogleWalletPassSourceResult =
  | { ok: true; source: GoogleWalletPassSource }
  | { ok: false; status: 404 | 500; message: string };

function publicAppOrigin(requestUrl: string) {
  const configured = process.env.SWIFTWALLET_PUBLIC_URL?.trim();
  const origin = resolvePublicOrigin(configured || new URL(requestUrl).origin);
  if (!origin || !origin.startsWith("https://")) {
    throw new Error("Google Wallet requires a public HTTPS origin.");
  }
  return origin;
}

export async function loadGoogleWalletPassSource(
  cardToken: string,
  requestUrl: string,
): Promise<GoogleWalletPassSourceResult> {
  const supabase = createSupabaseAdminClient();
  const { data: card, error: cardError } = await supabase
    .from("customer_cards")
    .select("id,tenant_id,customer_id,loyalty_card_id,public_token,status")
    .eq("public_token", cardToken)
    .maybeSingle();
  if (cardError || !card) {
    return { ok: false, status: 404, message: "La tarjeta no está disponible." };
  }

  const { data: configuration, error: configurationError } = await supabase
    .from("loyalty_cards")
    .select("id,program_id,status,wallet_enabled,background_color,logo_image_url,strip_image_url")
    .eq("id", card.loyalty_card_id)
    .eq("tenant_id", card.tenant_id)
    .maybeSingle();
  if (configurationError || !configuration) {
    return { ok: false, status: 404, message: "La tarjeta no está disponible." };
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("loyalty_card_branches")
    .select("branch_id")
    .eq("loyalty_card_id", configuration.id);
  if (assignmentsError) {
    return { ok: false, status: 500, message: "No se pudo preparar la tarjeta para Google Wallet." };
  }
  const branchIds = (assignments ?? []).map((assignment) => assignment.branch_id);

  const [tenantResult, customerResult, balanceResult, programResult, branchesResult] = await Promise.all([
    supabase
      .from("tenants")
      .select("name,status,logo_url,banner_url")
      .eq("id", card.tenant_id)
      .maybeSingle(),
    supabase
      .from("customers")
      .select("full_name,status")
      .eq("id", card.customer_id)
      .eq("tenant_id", card.tenant_id)
      .maybeSingle(),
    supabase
      .from("customer_loyalty_balances")
      .select("stamp_balance,lifetime_points_tenths")
      .eq("customer_id", card.customer_id)
      .eq("tenant_id", card.tenant_id)
      .maybeSingle(),
    supabase
      .from("loyalty_programs")
      .select("id,name,program_type,reward_stamp_goal,terms_and_conditions,status,unit_name_singular,unit_name_plural")
      .eq("id", configuration.program_id)
      .maybeSingle(),
    supabase
      .from("branches")
      .select("latitude,longitude")
      .eq("tenant_id", card.tenant_id)
      .in("id", branchIds.length ? branchIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("status", "ACTIVE")
      .eq("proximity_enabled", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(10),
  ]);

  const tenant = tenantResult.data;
  const customer = customerResult.data;
  const program = programResult.data;
  if (
    tenantResult.error ||
    customerResult.error ||
    balanceResult.error ||
    programResult.error ||
    branchesResult.error ||
    !tenant ||
    !customer ||
    !program
  ) {
    return {
      ok: false,
      status: tenant || customer || program ? 500 : 404,
      message: "No se pudo preparar la tarjeta para Google Wallet.",
    };
  }

  if (
    tenant.status !== "ACTIVE" ||
    customer.status !== "ACTIVE" ||
    card.status !== "ACTIVE" ||
    configuration.status !== "PUBLISHED" ||
    !configuration.wallet_enabled
  ) {
    return { ok: false, status: 404, message: "Google Wallet no está habilitado para esta tarjeta." };
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
      .eq("loyalty_card_id", configuration.id)
      .eq("status", "AVAILABLE")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
  ]);
  if (tiersResult.error || rewardsResult.error) {
    return { ok: false, status: 500, message: "No se pudo preparar la tarjeta para Google Wallet." };
  }

  let origin: string;
  try {
    origin = publicAppOrigin(requestUrl);
  } catch {
    return { ok: false, status: 500, message: "Google Wallet requiere el dominio HTTPS público de morrow." };
  }

  const logoUrl = configuration.logo_image_url ?? tenant.logo_url ?? `${origin}/icons/icon-512.png`;
  const balance = program.program_type === "LIFETIME_POINTS"
    ? Math.floor(Number(balanceResult.data?.lifetime_points_tenths ?? 0) / 10)
    : Number(balanceResult.data?.stamp_balance ?? 0);
  const merchantLocations = (branchesResult.data ?? []).flatMap((branch) => {
    const latitude = Number(branch.latitude);
    const longitude = Number(branch.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? [{ latitude, longitude }]
      : [];
  });

  return {
    ok: true,
    source: {
      tenantId: card.tenant_id,
      customerId: card.customer_id,
      customerCardId: card.id,
      loyaltyCardId: configuration.id,
      tenantName: tenant.name,
      passData: {
        loyaltyCardId: configuration.id,
        customerCardId: card.id,
        tenantName: tenant.name,
        programName: program.name,
        customerName: customer.full_name,
        unitNameSingular: program.unit_name_singular,
        unitNamePlural: program.unit_name_plural,
        balance,
        availableRewards: rewardsResult.count ?? 0,
        rewardGoal: program.reward_stamp_goal,
        rewardTiers: (tiersResult.data ?? []).map((tier) => ({
          stampsRequired: tier.stamps_required,
          name: tier.name,
          description: tier.description,
        })),
        termsAndConditions: program.terms_and_conditions ?? "Consulta los términos y condiciones vigentes con el negocio.",
        backgroundColor: configuration.background_color,
        logoUrl,
        heroImageUrl: configuration.strip_image_url ?? tenant.banner_url,
        cardUrl: `${origin}/card/${encodeURIComponent(card.public_token)}`,
        // A paused program remains visible and its already-earned rewards remain usable.
        active: true,
        merchantLocations,
      },
    },
  };
}
