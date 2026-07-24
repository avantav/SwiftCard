import Link from "next/link";
import { requireInternalArea } from "@/lib/auth/server";
import { normalizePhone } from "@/lib/customers/phone";
import { updateCustomer } from "./actions";

type CustomersPageProps = {
  searchParams: Promise<{ q?: string; updated?: string; error?: string }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const context = await requireInternalArea("APP");
  const params = await searchParams;
  const search = (params.q ?? "").trim();
  let customers: Array<Record<string, unknown>> = [];

  if (search) {
    const nameResult = await context.supabase
      .from("customers")
      .select("id,full_name,normalized_phone,email,birth_date,status,source_branch_id")
      .ilike("full_name", `%${search}%`)
      .order("full_name")
      .limit(50);
    customers = (nameResult.data ?? []) as Array<Record<string, unknown>>;
    const phone = normalizePhone(search);
    if (phone.ok) {
      const phoneResult = await context.supabase
        .from("customers")
        .select("id,full_name,normalized_phone,email,birth_date,status,source_branch_id")
        .eq("normalized_phone", phone.value)
        .limit(1);
      for (const customer of phoneResult.data ?? []) {
        if (!customers.some((item) => item.id === customer.id)) customers.push(customer as Record<string, unknown>);
      }
    }
  }

  return (
    <main className="shell">
      <section className="panel" aria-labelledby="customers-title">
        <Link className="text-link" href="/app">Volver</Link>
        <p className="eyebrow">Clientes</p>
        <h1 id="customers-title" className="form-title">Buscar clientes</h1>
        {params.updated ? <p className="success-alert" role="status">Cliente actualizado.</p> : null}
        {params.error ? <p className="auth-alert" role="alert">{params.error}</p> : null}
        <form className="auth-form" method="get">
          <label className="field"><span>Teléfono exacto o nombre</span><input name="q" defaultValue={search} /></label>
          <button className="primary-button" type="submit">Buscar</button>
        </form>
        {search && customers.length === 0 ? <p className="empty-state">No se encontraron clientes.</p> : null}
        <div className="data-list">
          {customers.map((customer) => (
            <div key={String(customer.id)} className="staff-row">
              <strong>{String(customer.full_name)}</strong>
              <span>{String(customer.normalized_phone)} · {String(customer.status)}</span>
              <form className="auth-form" action={updateCustomer}>
                <input type="hidden" name="customerId" value={String(customer.id)} />
                <label className="field"><span>Nombre</span><input name="fullName" defaultValue={String(customer.full_name)} required /></label>
                <label className="field"><span>Teléfono</span><input name="phone" defaultValue={String(customer.normalized_phone)} required /></label>
                <label className="field"><span>Correo</span><input name="email" type="email" defaultValue={customer.email ? String(customer.email) : ""} /></label>
                <label className="field"><span>Fecha de nacimiento</span><input name="birthDate" type="date" defaultValue={customer.birth_date ? String(customer.birth_date) : ""} /></label>
                <label className="field"><span><input name="privacyConsent" type="checkbox" defaultChecked /> Confirmo el consentimiento registrado.</span></label>
                <label className="field"><span>Estado</span><select name="status" defaultValue={String(customer.status)}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label>
                <button className="secondary-button" type="submit">Guardar cambios</button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
