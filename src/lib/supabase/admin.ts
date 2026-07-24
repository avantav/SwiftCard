import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  getRequiredPublicSupabaseConfig,
  getServerSupabaseServiceRoleKey
} from "./config";

export function createSupabaseAdminClient() {
  const config = getRequiredPublicSupabaseConfig();
  const serviceRoleKey = getServerSupabaseServiceRoleKey();

  if (!serviceRoleKey) {
    throw new Error("Missing Supabase service role key");
  }

  return createClient(config.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

