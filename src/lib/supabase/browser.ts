"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getRequiredPublicSupabaseConfig } from "./config";

export function createSupabaseBrowserClient() {
  const config = getRequiredPublicSupabaseConfig();

  return createBrowserClient(config.url, config.anonKey);
}

