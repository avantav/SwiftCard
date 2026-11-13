"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import {
  clientAddress,
  isRecoveryToken,
  normalizeRecoveryEmail,
  recoveryLink,
  RECOVERY_NEW_PASSWORD_PATH,
  RECOVERY_PATH,
  sha256Hex
} from "@/lib/auth/password-recovery";
import { validateNewPasswordForm } from "@/lib/auth/passwords";
import { getDefaultInternalRoute } from "@/lib/auth/routes";
import { emailConfig, sendEmail } from "@/lib/email/resend";
import { renderPasswordRecoveryEmail } from "@/lib/email/templates";
import { resolvePublicOrigin } from "@/lib/public-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function logRecoveryError(scope: string, error: unknown) {
  console.error(`[owner-password-recovery:${scope}]`, {
    message: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200)
  });
}

/**
 * Sends the recovery email after the response, so the answer and its timing
 * are the same whether or not the email belongs to an eligible owner.
 */
async function sendRecoveryEmailIfEligible(email: string, clientHash: string) {
  try {
    const origin = resolvePublicOrigin(process.env.SWIFTWALLET_PUBLIC_URL);
    if (!origin || !emailConfig().configured) return;

    const admin = createSupabaseAdminClient();
    const { data: ownerId, error } = await admin.schema("app").rpc("request_owner_password_recovery", {
      target_email: email,
      target_email_hash: sha256Hex(email),
      target_client_hash: clientHash
    });
    if (error || typeof ownerId !== "string") return;

    const [{ data: profile }, { data: link, error: linkError }] = await Promise.all([
      admin.from("staff_profiles").select("full_name").eq("id", ownerId).maybeSingle(),
      admin.auth.admin.generateLink({ type: "recovery", email })
    ]);
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !link?.user || link.user.id !== ownerId || !isRecoveryToken(tokenHash)) return;

    const rendered = renderPasswordRecoveryEmail({
      fullName: profile?.full_name ?? "",
      resetUrl: recoveryLink(origin, tokenHash)
    });
    const result = await sendEmail({
      to: email,
      fromName: "morrow",
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: `owner-recovery:${sha256Hex(tokenHash).slice(0, 48)}`
    });
    if (!result.ok) logRecoveryError("send", result.error);
  } catch (error) {
    logRecoveryError("request", error);
  }
}

export async function requestPasswordRecovery(formData: FormData) {
  const email = normalizeRecoveryEmail(formData.get("email"));
  if (!email) redirect(`${RECOVERY_PATH}?error=invalid_email`);

  const clientHash = sha256Hex(clientAddress(await headers()));
  after(() => sendRecoveryEmailIfEligible(email, clientHash));
  redirect(`${RECOVERY_PATH}?sent=1`);
}

export async function completePasswordRecovery(formData: FormData) {
  const token = formData.get("token");
  if (!isRecoveryToken(token)) redirect(`${RECOVERY_PATH}?error=invalid_link`);

  const validation = validateNewPasswordForm(formData);
  if (!validation.ok) {
    const params = new URLSearchParams({ token, error: validation.errors[0] ?? "Contraseña inválida." });
    redirect(`${RECOVERY_NEW_PASSWORD_PATH}?${params.toString()}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: token,
    type: "recovery"
  });
  const userId = verified?.user?.id;
  if (verifyError || !userId) redirect(`${RECOVERY_PATH}?error=invalid_link`);

  let succeeded = false;
  try {
    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
      .from("staff_profiles")
      .select("role,status,tenants!inner(status)")
      .eq("id", userId)
      .maybeSingle();
    const tenant = Array.isArray(profile?.tenants) ? profile?.tenants[0] : profile?.tenants;
    const eligible = profile?.role === "ADMIN"
      && ["ACTIVE", "PASSWORD_RESET_REQUIRED"].includes(String(profile.status))
      && tenant?.status === "ACTIVE";

    if (eligible) {
      const { error: updateError } = await supabase.auth.updateUser({ password: validation.data.newPassword });
      if (!updateError) {
        const { data: completed, error: completeError } = await admin
          .schema("app")
          .rpc("complete_owner_password_recovery", { target_user_id: userId });
        succeeded = !completeError && completed === true;
        if (succeeded) await supabase.auth.signOut({ scope: "others" });
      } else {
        logRecoveryError("update", updateError);
      }
    }
  } catch (error) {
    logRecoveryError("complete", error);
  }

  if (!succeeded) {
    // The recovery session must not outlive a failed reset.
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    redirect(`${RECOVERY_PATH}?error=reset_failed`);
  }
  redirect(getDefaultInternalRoute("ADMIN"));
}
