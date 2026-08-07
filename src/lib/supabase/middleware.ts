import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import {
  swiftWalletAuthCookieEncoding,
  swiftWalletAuthCookieOptions,
} from "./auth-cookies";
import { getPublicSupabaseConfig } from "./config";

export type SupabaseMiddlewareResult = {
  response: NextResponse;
  user: User | null;
  configured: boolean;
};

export async function updateSupabaseSession(
  request: NextRequest
): Promise<SupabaseMiddlewareResult> {
  let response = NextResponse.next({
    request
  });
  const config = getPublicSupabaseConfig();

  if (!config) {
    return {
      response,
      user: null,
      configured: false
    };
  }

  const supabase = createServerClient(config.url, config.anonKey, {
    cookieOptions: swiftWalletAuthCookieOptions,
    cookies: {
      encode: swiftWalletAuthCookieEncoding,
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  return {
    response,
    user,
    configured: true
  };
}

export function copyAuthCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
}
