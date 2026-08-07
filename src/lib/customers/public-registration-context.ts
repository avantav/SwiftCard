import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublicRegistrationContext = {
  branchName: string;
  tenantName: string;
};

export async function getPublicRegistrationContext(branchToken: string) {
  if (!branchToken || branchToken.length > 256) return null;
  try {
    const supabase = createSupabaseAdminClient();
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("tenant_id,name,status")
      .eq("public_registration_token", branchToken)
      .maybeSingle();
    if (branchError || !branch || branch.status !== "ACTIVE") return null;

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("name,status")
      .eq("id", branch.tenant_id)
      .maybeSingle();
    if (tenantError || !tenant || tenant.status !== "ACTIVE") return null;

    return {
      branchName: branch.name,
      tenantName: tenant.name,
    } satisfies PublicRegistrationContext;
  } catch {
    return null;
  }
}
