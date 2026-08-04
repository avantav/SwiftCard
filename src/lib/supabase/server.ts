import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  swiftWalletAuthCookieEncoding,
  swiftWalletAuthCookieOptions,
} from "./auth-cookies";
import { getRequiredPublicSupabaseConfig } from "./config";

export async function createSupabaseServerClient() {
  const config = getRequiredPublicSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookieOptions: swiftWalletAuthCookieOptions,
    cookies: {
      encode: swiftWalletAuthCookieEncoding,
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components cannot always write cookies; middleware refreshes sessions.
        }
      }
    }
  });
}
