"use server";

import { redirect } from "next/navigation";
import { isCustomerCardToken } from "@/lib/customers/card-qr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ClaimDestination = "APPLE" | "WEB";

function claimRedirect(cardToken: string, error: string): never {
  redirect(`/card/${encodeURIComponent(cardToken)}?${new URLSearchParams({ claim: "1", error }).toString()}`);
}

export async function acceptCardTerms(
  cardToken: string,
  programVersion: number,
  destination: ClaimDestination,
  formData: FormData,
) {
  if (!isCustomerCardToken(cardToken) || !Number.isSafeInteger(programVersion) || programVersion < 1) {
    claimRedirect(cardToken, "La tarjeta ya no está disponible.");
  }
  if (formData.get("acceptTerms") !== "on") {
    claimRedirect(cardToken, "Debes aceptar los términos y condiciones.");
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    claimRedirect(cardToken, "No se pudo guardar la aceptación. Intenta nuevamente.");
  }
  const { data, error } = await supabase.schema("app").rpc("accept_public_card_terms", {
    target_card_token: cardToken,
    target_program_version: programVersion,
  });
  if (error || data !== "ACCEPTED") {
    claimRedirect(cardToken, data === "UNAVAILABLE" ? "Los términos cambiaron. Revisa la versión vigente." : "No se pudo guardar la aceptación. Intenta nuevamente.");
  }

  if (destination === "APPLE") {
    redirect(`/api/wallet/apple/${encodeURIComponent(cardToken)}`);
  }
  redirect(`/card/${encodeURIComponent(cardToken)}`);
}
