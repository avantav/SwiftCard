import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { registerEmployeeCustomer } from "./register/actions";

type EmployeeAppPageProps = { searchParams: Promise<{ created?: string; duplicate?: string; error?: string; cardToken?: string }> };

export default async function EmployeeAppPage({ searchParams }: EmployeeAppPageProps) {
  const context = await requireInternalArea("APP");
  const { created, duplicate, error, cardToken } = await searchParams;
  const { data: branches, error: branchesError } = await context.supabase.from("branches").select("id,name,status").eq("status", "ACTIVE").order("name");

  return <main className="operations-page">
    <header className="operations-page-header"><p>Operación</p><h1>Registrar cliente</h1><span>Crea su perfil y tarjeta digital desde el punto de atención.</span></header>
    {created && cardToken ? <div className="operations-alert is-success" role="status"><strong>Cliente registrado.</strong><span>La tarjeta ya está disponible.</span><Link href={`/card/${encodeURIComponent(cardToken)}`}>Abrir tarjeta</Link></div> : null}
    {duplicate ? <p className="operations-alert is-error" role="alert">Este teléfono ya está registrado en este tenant.</p> : null}
    {error ? <p className="operations-alert is-error" role="alert">{error}</p> : null}
    {branchesError ? <p className="operations-alert is-error" role="alert">No se pudieron cargar las sucursales. Actualiza la página.</p> : null}
    <section className="operations-card" aria-labelledby="customer-data-title">
      <div className="operations-card-header"><h2 id="customer-data-title">Datos del cliente</h2><p>Los campos opcionales pueden completarse después.</p></div>
      <form className="operations-form" action={registerEmployeeCustomer}>
        <label className="field"><span>Sucursal</span><select name="branchId" required defaultValue=""><option value="">Selecciona una sucursal</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <label className="field"><span>Nombre completo</span><input name="fullName" required autoComplete="name" /></label>
        <label className="field"><span>Teléfono</span><input name="phone" required type="tel" inputMode="tel" autoComplete="tel" /></label>
        <label className="field"><span>Correo electrónico <small>(opcional)</small></span><input name="email" type="email" inputMode="email" autoComplete="email" /></label>
        <label className="field"><span>Fecha de nacimiento <small>(opcional)</small></span><input name="birthDate" type="date" /></label>
        <label className="check-field operations-check"><input name="privacyConsent" type="checkbox" required /><span>Confirmo que el cliente aceptó el aviso de privacidad.</span></label>
        <SubmitButton className="operations-primary-button">Registrar cliente</SubmitButton>
      </form>
    </section>
  </main>;
}
