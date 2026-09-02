"use server";

import { redirect } from "next/navigation";
import { isCustomerCardToken } from "@/lib/customers/card-qr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ClaimDestination = "APPLE" | "GOOGLE" | "WEB";

function claimRedirect(cardToken: string, error: string): never {
  redirect(`/card/${encodeURIComponent(cardToken)}?${new URLSearchParams({ claim: "1", error }).toString()}`);
}

export async function acceptCardTerms(
  cardToken: string,
  programVersion: number,
  formData: FormData,
) {
  if (!isCustomerCardToken(cardToken) || !Number.isSafeInteger(programVersion) || programVersion < 1) {
    claimRedirect(cardToken, "La tarjeta ya no está disponible.");
  }
  if (formData.get("acceptTerms") !== "on") {
    claimRedirect(cardToken, "Debes aceptar los términos y condiciones.");
  }
  const destination = formData.get("destination");
  if (!(["APPLE", "GOOGLE", "WEB"] satisfies ClaimDestination[]).includes(destination as ClaimDestination)) {
    claimRedirect(cardToken, "Selecciona dónde quieres agregar tu tarjeta.");
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
  if (destination === "GOOGLE") {
    redirect(`/api/wallet/google/${encodeURIComponent(cardToken)}`);
  }
  redirect(`/card/${encodeURIComponent(cardToken)}`);
}
