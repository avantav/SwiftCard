import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { normalizePhone } from "@/lib/customers/phone";
import { updateCustomer } from "./actions";

type CustomersPageProps = { searchParams: Promise<{ q?: string; updated?: string; error?: string }> };

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const context = await requireInternalArea("APP");
  const params = await searchParams;
  const search = (params.q ?? "").trim();
  const canEdit = context.access.role === "MANAGER";
  let customers: Array<Record<string, unknown>> = [];
  let searchFailed = false;

  if (search) {
    const nameResult = await context.supabase.from("customers").select("id,full_name,normalized_phone,email,birth_date,status,source_branch_id").ilike("full_name", `%${search}%`).order("full_name").limit(50);
    searchFailed = Boolean(nameResult.error);
    customers = (nameResult.data ?? []) as Array<Record<string, unknown>>;
    const phone = normalizePhone(search);
    if (phone.ok) {
      const phoneResult = await context.supabase.from("customers").select("id,full_name,normalized_phone,email,birth_date,status,source_branch_id").eq("normalized_phone", phone.value).limit(1);
      searchFailed = searchFailed || Boolean(phoneResult.error);
      for (const customer of phoneResult.data ?? []) if (!customers.some((item) => item.id === customer.id)) customers.push(customer as Record<string, unknown>);
    }
  }

  return <main className="operations-page">
    <header className="operations-page-header"><p>Clientes</p><h1>Buscar clientes</h1><span>Busca por teléfono exacto o por una parte del nombre.</span></header>
    {params.updated ? <p className="operations-alert is-success" role="status">Cliente actualizado.</p> : null}
    {params.error ? <p className="operations-alert is-error" role="alert">{params.error}</p> : null}
    {searchFailed ? <p className="operations-alert is-error" role="alert">No se pudo completar la búsqueda. Actualiza la página.</p> : null}
    <section className="operations-card operations-search-card" aria-label="Búsqueda de clientes">
      <form className="operations-search-form" method="get"><label className="field"><span>Teléfono o nombre</span><input name="q" defaultValue={search} inputMode="search" /></label><button className="operations-primary-button" type="submit">Buscar</button></form>
    </section>
    {searchFailed ? null : !search ? <div className="operations-empty-state"><h2>Busca un cliente</h2><p>Los resultados autorizados aparecerán aquí.</p></div> : customers.length === 0 ? <div className="operations-empty-state"><h2>Sin resultados</h2><p>Revisa el teléfono o intenta con menos palabras del nombre.</p></div> : <section className="operations-results" aria-label={`${customers.length} resultados`}>
      <p className="operations-results-count">{customers.length} {customers.length === 1 ? "cliente" : "clientes"}</p>
      {customers.map((customer) => <article className="operations-customer-card" key={String(customer.id)}>
        <div className="operations-customer-heading"><span className="enterprise-user-avatar" aria-hidden="true">{String(customer.full_name).split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{String(customer.full_name)}</strong><small>{String(customer.normalized_phone)}</small></span><span className={`enterprise-badge ${customer.status === "ACTIVE" ? "is-active" : "is-neutral"}`}>{customer.status === "ACTIVE" ? "Activo" : "Inactivo"}</span></div>
        <Link className="operations-secondary-button" href={`/app/purchase?customerId=${encodeURIComponent(String(customer.id))}`}>Registrar compra</Link>
        {canEdit ? <details className="operations-edit-details"><summary>Editar cliente</summary><form className="operations-form" action={updateCustomer}>
          <input type="hidden" name="customerId" value={String(customer.id)} />
          <label className="field"><span>Nombre</span><input name="fullName" defaultValue={String(customer.full_name)} required /></label>
          <label className="field"><span>Teléfono</span><input name="phone" defaultValue={String(customer.normalized_phone)} required /></label>
          <label className="field"><span>Correo <small>(opcional)</small></span><input name="email" type="email" defaultValue={customer.email ? String(customer.email) : ""} /></label>
          <label className="field"><span>Fecha de nacimiento <small>(opcional)</small></span><input name="birthDate" type="date" defaultValue={customer.birth_date ? String(customer.birth_date) : ""} /></label>
          <label className="check-field operations-check"><input name="privacyConsent" type="checkbox" defaultChecked /><span>Confirmo el consentimiento registrado.</span></label>
          <label className="field"><span>Estado</span><select name="status" defaultValue={String(customer.status)}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label>
          <SubmitButton className="operations-secondary-button">Guardar cambios</SubmitButton>
        </form></details> : null}
      </article>)}
    </section>}
  </main>;
}
