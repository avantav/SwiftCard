import "server-only";

import type { TenantLegalIdentity } from "@/lib/legal/company";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type TenantCardConditions = { cardName: string; programName: string; terms: string };

export type TenantLegalDocumentsContext = {
  business: TenantLegalIdentity;
  logoUrl: string | null;
  whiteLabel: boolean;
  cards: TenantCardConditions[];
  basePath: string;
};

const TOKEN_LIMIT = 256;

/**
 * Public, read-only context for the terms and privacy notice a business shows
 * its customers (DEC-0072). Resolved server-side from a public branch token
 * (registration QR) or a customer's card token; only published cards of an
 * active tenant are included and no customer data is returned.
 */
export async function getTenantLegalDocuments(source: { branchToken: string } | { cardToken: string }): Promise<TenantLegalDocumentsContext | null> {
  const token = "branchToken" in source ? source.branchToken : source.cardToken;
  if (!token || token.length > TOKEN_LIMIT) return null;
  try {
    const supabase = createSupabaseAdminClient();
    let tenantId: string;
    let cardIds: string[];
    let basePath: string;
    if ("branchToken" in source) {
      const { data: branch } = await supabase.from("branches")
        .select("id,tenant_id,status").eq("public_registration_token", token).maybeSingle();
      if (!branch || branch.status !== "ACTIVE") return null;
      const { data: assignments, error } = await supabase.from("loyalty_card_branches")
        .select("loyalty_card_id").eq("branch_id", branch.id);
      if (error) return null;
      tenantId = branch.tenant_id;
      cardIds = (assignments ?? []).map((item) => item.loyalty_card_id);
      basePath = `/register/${encodeURIComponent(token)}`;
    } else {
      const { data: issued } = await supabase.from("customer_cards")
        .select("tenant_id,loyalty_card_id,status").eq("public_token", token).maybeSingle();
      if (!issued || issued.status !== "ACTIVE") return null;
      tenantId = issued.tenant_id;
      cardIds = [issued.loyalty_card_id];
      basePath = `/card/${encodeURIComponent(token)}`;
    }

    const { data: tenant } = await supabase.from("tenants")
      .select("name,status,branding_mode,logo_url,legal_name,legal_address,legal_contact_email,contact_email")
      .eq("id", tenantId).maybeSingle();
    if (!tenant || tenant.status !== "ACTIVE") return null;

    const { data: cards } = cardIds.length
      ? await supabase.from("loyalty_cards").select("name,program_id")
          .eq("tenant_id", tenantId).in("id", cardIds).eq("status", "PUBLISHED").order("name")
      : { data: [] as { name: string; program_id: string }[] };
    const programIds = (cards ?? []).map((card) => card.program_id);
    const { data: programs } = programIds.length
      ? await supabase.from("loyalty_programs").select("id,name,terms_and_conditions")
          .eq("tenant_id", tenantId).in("id", programIds)
      : { data: [] as { id: string; name: string; terms_and_conditions: string }[] };

    return {
      business: {
        tenantName: tenant.name,
        legalName: tenant.legal_name ?? null,
        legalAddress: tenant.legal_address ?? null,
        contactEmail: tenant.legal_contact_email ?? tenant.contact_email ?? null,
      },
      logoUrl: tenant.logo_url ?? null,
      whiteLabel: tenant.branding_mode === "WHITE_LABEL",
      cards: (cards ?? []).flatMap((card) => {
        const program = programs?.find((item) => item.id === card.program_id);
        return program ? [{ cardName: card.name, programName: program.name, terms: program.terms_and_conditions }] : [];
      }),
      basePath,
    };
  } catch {
    return null;
  }
}
