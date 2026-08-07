"use client";

import { createBrowserClient } from "@supabase/ssr";
import {
  swiftWalletAuthCookieEncoding,
  swiftWalletAuthCookieOptions,
} from "./auth-cookies";
import { getRequiredPublicSupabaseConfig } from "./config";

export function createSupabaseBrowserClient() {
  const config = getRequiredPublicSupabaseConfig();

  return createBrowserClient(config.url, config.anonKey, {
    cookieOptions: swiftWalletAuthCookieOptions,
    cookies: {
      encode: swiftWalletAuthCookieEncoding,
    },
  });
}
