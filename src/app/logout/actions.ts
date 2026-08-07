"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { PIN_SESSION_COOKIE, pinSessionCookieOptions } from "@/lib/auth/pin-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").rpc("revoke_current_pin_session");
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.set(PIN_SESSION_COOKIE, "", { ...pinSessionCookieOptions, maxAge: 0 });
  redirect("/login");
}
