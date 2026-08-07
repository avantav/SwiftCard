import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  swiftWalletAuthCookieEncoding,
  swiftWalletAuthCookieOptions,
} from "./auth-cookies";
import { PIN_SESSION_COOKIE, PIN_SESSION_HEADER } from "@/lib/auth/pin-session";
import { getRequiredPublicSupabaseConfig } from "./config";

export async function createSupabaseServerClient() {
  const config = getRequiredPublicSupabaseConfig();
  const cookieStore = await cookies();
  const operatorSession = cookieStore.get(PIN_SESSION_COOKIE)?.value;

  return createServerClient(config.url, config.anonKey, {
    global: operatorSession
      ? { headers: { [PIN_SESSION_HEADER]: operatorSession } }
      : undefined,
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
