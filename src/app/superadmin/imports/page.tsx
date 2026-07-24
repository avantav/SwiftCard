import Link from "next/link";
import { requireInternalArea } from "@/lib/auth/server";
import { uploadCustomerImport } from "./actions";

type ImportsPageProps = { searchParams: Promise<{ error?: string }> };

export default async function ImportsPage({ searchParams }: ImportsPageProps) {
  const context = await requireInternalArea("SUPERADMIN");
  const { error } = await searchParams;
  const { data: tenants } = await context.supabase.from("tenants").select("id,name").order("name");

  return (
    <main className="shell">
      <section className="panel" aria-labelledby="imports-title">
        <Link className="text-link" href="/superadmin">Volver</Link>
        <p className="eyebrow">Importaciones</p>
        <h1 id="imports-title" className="form-title">Cargar clientes</h1>
        {error ? <p className="error-alert" role="alert">{error}</p> : null}
        <form className="auth-form" action={uploadCustomerImport}>
          <label className="field"><span>Tenant</span><select name="tenantId" required defaultValue=""><option value="" disabled>Selecciona un tenant</option>{tenants?.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></label>
          <label className="field"><span>Archivo CSV o Excel</span><input name="file" type="file" accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></label>
          <button className="primary-button" type="submit">Subir archivo</button>
        </form>
      </section>
    </main>
  );
}
