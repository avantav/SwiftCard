"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  isSixDigitPin,
  PIN_SESSION_COOKIE,
  pinSessionCookieOptions
} from "@/lib/auth/pin-session";
import { requireInternalArea } from "@/lib/auth/server";

export type PinUnlockState = {
  attempt: number;
  error: string | null;
  status: "IDLE" | "ERROR" | "SUCCESS";
};

export async function unlockWithPin(
  previousState: PinUnlockState,
  formData: FormData,
): Promise<PinUnlockState> {
  const pin = formData.get("pin");
  if (!isSixDigitPin(pin)) {
    return {
      attempt: previousState.attempt + 1,
      error: "Ingresa un PIN de seis dígitos.",
      status: "ERROR",
    };
  }

  const context = await requireInternalArea("APP", { allowLockedShared: true });
  if (context.accountKind !== "BRANCH_SHARED") {
    return { attempt: previousState.attempt + 1, error: null, status: "SUCCESS" };
  }

  const { data, error } = await context.supabase
    .schema("app")
    .rpc("unlock_branch_pin", { target_pin: pin });
  const result = Array.isArray(data) ? data[0] : null;

  if (error || !result) {
    return {
      attempt: previousState.attempt + 1,
      error: "No se pudo validar el PIN.",
      status: "ERROR",
    };
  }
  if (result.result === "LOCKED") {
    return {
      attempt: previousState.attempt + 1,
      error: "El acceso por PIN está bloqueado durante cinco minutos.",
      status: "ERROR",
    };
  }
  if (result.result !== "UNLOCKED" || typeof result.session_token !== "string") {
    return {
      attempt: previousState.attempt + 1,
      error: "El PIN no es válido.",
      status: "ERROR",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(PIN_SESSION_COOKIE, result.session_token, pinSessionCookieOptions);
  return { attempt: previousState.attempt + 1, error: null, status: "SUCCESS" };
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
