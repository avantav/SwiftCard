import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getActiveSuperadminContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "SUPERADMIN" || profile.status !== "ACTIVE") {
    return null;
  }

  return {
    supabase,
    userId: user.id
  };
}
