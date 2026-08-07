"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  isSixDigitPin,
  PIN_SESSION_COOKIE,
  pinSessionCookieOptions
} from "@/lib/auth/pin-session";
import { requireInternalArea } from "@/lib/auth/server";

function back(error: string): never {
  redirect(`/app/unlock?error=${encodeURIComponent(error)}`);
}

export async function unlockWithPin(formData: FormData) {
  const pin = formData.get("pin");
  if (!isSixDigitPin(pin)) {
    back("Ingresa un PIN de seis dígitos.");
  }

  const context = await requireInternalArea("APP", { allowLockedShared: true });
  if (context.accountKind !== "BRANCH_SHARED") {
    redirect("/app");
  }

  const { data, error } = await context.supabase
    .schema("app")
    .rpc("unlock_branch_pin", { target_pin: pin });
  const result = Array.isArray(data) ? data[0] : null;

  if (error || !result) {
    back("No se pudo validar el PIN.");
  }
  if (result.result === "LOCKED") {
    back("El acceso por PIN está bloqueado durante cinco minutos.");
  }
  if (result.result !== "UNLOCKED" || typeof result.session_token !== "string") {
    back("El PIN no es válido.");
  }

  const cookieStore = await cookies();
  cookieStore.set(PIN_SESSION_COOKIE, result.session_token, pinSessionCookieOptions);
  redirect("/app");
}

export async function changePinOperator() {
  const context = await requireInternalArea("APP", { allowLockedShared: true });
  if (context.accountKind === "BRANCH_SHARED") {
    await context.supabase.schema("app").rpc("revoke_current_pin_session");
  }
  const cookieStore = await cookies();
  cookieStore.set(PIN_SESSION_COOKIE, "", { ...pinSessionCookieOptions, maxAge: 0 });
  redirect("/app/unlock");
}
