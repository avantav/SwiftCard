import { requireInternalArea } from "@/lib/auth/server";
import { registerEmployeeCustomer } from "./register/actions";

type EmployeeAppPageProps = {
  searchParams: Promise<{ created?: string; duplicate?: string; error?: string; cardToken?: string }>;
};

export default async function EmployeeAppPage({ searchParams }: EmployeeAppPageProps) {
  const context = await requireInternalArea("APP");
  const { created, duplicate, error, cardToken } = await searchParams;
  const { data: branches } = await context.supabase
    .from("branches")
    .select("id,name,status")
    .eq("status", "ACTIVE")
    .order("name");
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">PWA empleados</p>
        <h1 className="title">Registrar cliente.</h1>
        <p className="body-copy"><a className="text-link" href="/app/customers">Buscar clientes</a></p>
        {created && cardToken ? <p className="success-alert" role="status">Cliente registrado. <a className="text-link" href={`/card/${encodeURIComponent(cardToken)}`}>Abrir tarjeta</a></p> : null}
        {duplicate ? <p className="auth-alert" role="alert">Este teléfono ya está registrado en este tenant.</p> : null}
        {error ? <p className="auth-alert" role="alert">{error}</p> : null}
        <form className="auth-form" action={registerEmployeeCustomer}>
          <label className="field"><span>Sucursal</span><select name="branchId" required defaultValue=""><option value="">Selecciona</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label className="field"><span>Nombre completo</span><input name="fullName" required autoComplete="name" /></label>
          <label className="field"><span>Teléfono</span><input name="phone" required type="tel" autoComplete="tel" /></label>
          <label className="field"><span>Correo electrónico (opcional)</span><input name="email" type="email" autoComplete="email" /></label>
          <label className="field"><span>Fecha de nacimiento (opcional)</span><input name="birthDate" type="date" /></label>
          <label className="field"><span><input name="privacyConsent" type="checkbox" required /> Acepto el aviso de privacidad.</span></label>
          <button className="primary-button" type="submit">Registrar cliente</button>
        </form>
      </section>
    </main>
  );
}
