import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getRequiredPublicSupabaseConfig } from "./config";

/** Public enrollment must not inherit a staff JWT, PIN context or browser cookies. */
export function createSupabasePublicServerClient() {
  const config = getRequiredPublicSupabaseConfig();
  return createClient(config.url, config.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
