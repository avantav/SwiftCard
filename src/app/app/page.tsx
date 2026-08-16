import { headers } from "next/headers";
import { EmployeeRegistrationHandoff } from "@/components/employee-registration-handoff";
import { RegistrationScopeFields, type RegistrationScope } from "@/components/registration-scope-fields";
import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { isCustomerCardToken } from "@/lib/customers/card-qr";
import { resolvePublicOrigin } from "@/lib/public-origin";
import { registerEmployeeCustomer } from "./register/actions";

type EmployeeAppPageProps = { searchParams: Promise<{ created?: string; duplicate?: string; error?: string; cardToken?: string }> };

export default async function EmployeeAppPage({ searchParams }: EmployeeAppPageProps) {
  const context = await requireInternalArea("APP");
  const { created, duplicate, error, cardToken } = await searchParams;
  if (created === "1" && cardToken && isCustomerCardToken(cardToken)) {
    let claimOrigin = resolvePublicOrigin(process.env.SWIFTWALLET_PUBLIC_URL);
    if (!claimOrigin && process.env.NODE_ENV !== "production") {
      const requestHeaders = await headers();
      const host = requestHeaders.get("host");
      const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
      try {
        const requestOrigin = host ? new URL(`${protocol}://${host}`) : null;
        claimOrigin = requestOrigin && ["http:", "https:"].includes(requestOrigin.protocol)
          ? requestOrigin.origin
          : null;
      } catch {
        claimOrigin = null;
      }
    }
    return <main className="operations-page operations-handoff-page">
      <EmployeeRegistrationHandoff cardToken={cardToken} origin={claimOrigin} />
    </main>;
  }
  const { data: rawScopes, error: scopesError } = await context.supabase.schema("app").rpc("get_staff_registration_scopes");
  const scopes = (rawScopes ?? []) as RegistrationScope[];

  return <main className="operations-page">
    <header className="operations-page-header"><p>Operación</p><h1>Registrar cliente</h1><span>Crea su perfil y tarjeta digital desde el punto de atención.</span></header>
    {duplicate ? <p className="operations-alert is-error" role="alert">Este teléfono ya está registrado en este tenant.</p> : null}
    {error ? <p className="operations-alert is-error" role="alert">{error}</p> : null}
    {scopesError ? <p className="operations-alert is-error" role="alert">No se pudieron cargar las tarjetas y sucursales. Actualiza la página.</p> : null}
    {!scopesError && !scopes.length ? <p className="operations-alert is-warning" role="status">No hay tarjetas publicadas disponibles en tus sucursales.</p> : null}
    <section className="operations-card" aria-labelledby="customer-data-title">
      <div className="operations-card-header"><h2 id="customer-data-title">Datos del cliente</h2><p>Los campos opcionales pueden completarse después.</p></div>
      <form className="operations-form" action={registerEmployeeCustomer}>
        <RegistrationScopeFields scopes={scopes} />
        <label className="field"><span>Nombre completo</span><input name="fullName" required autoComplete="name" /></label>
        <label className="field"><span>Teléfono</span><input name="phone" required type="tel" inputMode="tel" autoComplete="tel" /></label>
        <label className="field"><span>Correo electrónico <small>(opcional)</small></span><input name="email" type="email" inputMode="email" autoComplete="email" /></label>
        <label className="field"><span>Fecha de nacimiento <small>(opcional)</small></span><input name="birthDate" type="date" /></label>
        <label className="check-field operations-check"><input name="privacyConsent" type="checkbox" required /><span>Confirmo que el cliente aceptó el aviso de privacidad.</span></label>
        <SubmitButton className="operations-primary-button" disabled={!scopes.length}>Registrar cliente</SubmitButton>
      </form>
    </section>
  </main>;
}
