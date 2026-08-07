import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { uploadCustomerImport } from "./actions";

type ImportsPageProps = { searchParams: Promise<{ error?: string }> };

export default async function ImportsPage({ searchParams }: ImportsPageProps) {
  const context = await requireInternalArea("SUPERADMIN");
  const { error } = await searchParams;
  const { data: tenants } = await context.supabase.from("tenants").select("id,name").order("name");

  return (
    <main className="enterprise-page">
      <header className="enterprise-page-header">
        <div>
          <p className="enterprise-breadcrumb">Importaciones</p>
          <h1 id="imports-title">Cargar clientes</h1>
          <p>Sube un archivo y valida sus columnas antes de crear registros.</p>
        </div>
        <Link className="enterprise-secondary-action" href="/superadmin">Volver a tenants</Link>
      </header>
      <section className="enterprise-content-card" aria-labelledby="imports-title">
        {error ? <p className="enterprise-alert is-error" role="alert">{error}</p> : null}
        <form className="auth-form" action={uploadCustomerImport}>
          <label className="field"><span>Tenant</span><select name="tenantId" required defaultValue=""><option value="" disabled>Selecciona un tenant</option>{tenants?.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></label>
          <label className="field"><span>Archivo CSV o Excel</span><input name="file" type="file" accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></label>
          <SubmitButton>Subir archivo</SubmitButton>
        </form>
      </section>
    </main>
  );
}
