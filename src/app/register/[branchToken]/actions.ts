"use server";

import { headers } from "next/headers";
import { createPublicCardScanUrl } from "@/lib/customers/card-scan-server";

import { createCustomerCardQrDataUrl, isCustomerCardToken } from "@/lib/customers/card-qr";
import { readMarketingConsent, recordMarketingConsentBestEffort } from "@/lib/customers/marketing-consent";
import { sendWelcomeEmailBestEffort } from "@/lib/email/customer-emails";
import { validatePublicCustomerRegistration } from "@/lib/customers/registration";
import type { RegistrationState } from "@/lib/customers/registration-state";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";
import { isPublicAppleWalletAvailable, isPublicGoogleWalletAvailable } from "@/lib/wallet/public-availability";

export async function loadRegistrationCard(cardToken: string): Promise<RegistrationState> {
  if (!isCustomerCardToken(cardToken)) return { error: "La tarjeta no está disponible." };
  try {
    const supabase = createSupabasePublicServerClient();
    const [claim, card, acceptance, appleWalletAvailable, googleWalletAvailable] = await Promise.all([
      supabase.schema("app").rpc("get_public_card_claim", { target_card_token: cardToken }),
      supabase.schema("app").rpc("get_public_web_card", { target_card_token: cardToken }),
      supabase.schema("app").rpc("public_card_terms_are_accepted", { target_card_token: cardToken }),
      isPublicAppleWalletAvailable(cardToken),
      isPublicGoogleWalletAvailable(cardToken),
    ]);
    if (claim.error || card.error || !claim.data?.[0] || !card.data?.[0]) {
      return { cardToken, error: "Tu registro se guardó. Intenta cargar tu tarjeta nuevamente." };
    }
    let qrDataUrl: string | undefined;
    try { qrDataUrl = await createCustomerCardQrDataUrl(createPublicCardScanUrl(cardToken, await registrationRequestOrigin())); } catch { /* Allow retry without repeating registration. */ }
    return {
      cardToken, claim: claim.data[0], card: card.data[0], qrDataUrl,
      accepted: !acceptance.error && acceptance.data === true,
      appleWalletAvailable, googleWalletAvailable,
    };
  } catch {
    return { cardToken, error: "Tu registro se guardó. Intenta cargar tu tarjeta nuevamente." };
  }
}

export async function registerCustomer(branchToken: string, previous: RegistrationState, formData: FormData): Promise<RegistrationState> {
  if (previous.cardToken) return loadRegistrationCard(previous.cardToken);
  const loyaltyCardId = formData.get("loyaltyCardId");
  if (typeof loyaltyCardId !== "string" || !loyaltyCardId) return { error: "Selecciona una tarjeta." };
  const validation = validatePublicCustomerRegistration(formData);
  if (!validation.ok) return { error: validation.errors.join(" ") };
  try {
    const supabase = createSupabasePublicServerClient();
    const { data, error } = await supabase.schema("app").rpc("register_public_customer", {
      target_branch_token: branchToken,
      target_loyalty_card_id: loyaltyCardId,
      target_full_name: validation.data.fullName,
      target_normalized_phone: validation.data.phone,
      target_email: validation.data.email ?? "",
      target_birth_date: validation.data.birthDate,
      target_privacy_consent: validation.data.privacyConsent,
    });
    const result = Array.isArray(data) ? data[0] : null;
    if (error || !result) return { error: "El registro no está disponible. Intenta nuevamente." };
    if (result.result === "DUPLICATE") return { error: "Este teléfono ya está registrado. Solicita ayuda a un empleado para recuperar tu tarjeta." };
    if (!["CREATED", "IMPORTED_RECOVERY"].includes(result.result) || !isCustomerCardToken(result.card_token)) {
      return { error: "La tarjeta o sucursal ya no está disponible." };
    }
    await recordMarketingConsentBestEffort(supabase, result.card_token, readMarketingConsent(formData));
    if (result.result === "CREATED") await sendWelcomeEmailBestEffort(result.card_token);
    if (formData.get("acceptTerms") === "on") {
      return acceptRegistrationTerms(result.card_token, Number(formData.get("programVersion")), {}, formData);
    }
    return loadRegistrationCard(result.card_token);
  } catch {
    return { error: "El registro no está disponible. Intenta nuevamente." };
  }
}

export async function acceptRegistrationTerms(cardToken: string, programVersion: number, _previous: RegistrationState, formData: FormData): Promise<RegistrationState> {
  const current = await loadRegistrationCard(cardToken);
  if (!current.claim) return current;
  if (formData.get("acceptTerms") !== "on") return { ...current, error: "Debes aceptar los términos y condiciones." };
  if (!Number.isSafeInteger(programVersion) || programVersion !== current.claim.program_version) {
    return { ...current, error: "Los términos cambiaron. Revisa la versión vigente y vuelve a aceptarlos." };
  }
  try {
    const supabase = createSupabasePublicServerClient();
    const { data, error } = await supabase.schema("app").rpc("accept_public_card_terms", {
      target_card_token: cardToken,
      target_program_version: programVersion,
    });
    if (error || data !== "ACCEPTED") {
      const refreshed = await loadRegistrationCard(cardToken);
      return { ...refreshed, error: data === "UNAVAILABLE" ? "Los términos cambiaron. Revisa la versión vigente y vuelve a aceptarlos." : "No se pudo guardar la aceptación. Intenta nuevamente." };
    }
    return loadRegistrationCard(cardToken);
  } catch {
    return { ...current, error: "No se pudo guardar la aceptación. Intenta nuevamente." };
  }
}

async function registrationRequestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  return `${host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https"}://${host}`;
}
