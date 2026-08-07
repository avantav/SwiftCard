import { requireInternalArea } from "@/lib/auth/server";

const exportsList = [
  ["customers", "Clientes"],
  ["purchases", "Compras"],
  ["rewards", "Recompensas"],
  ["redemptions", "Canjes"],
  ["adjustments", "Ajustes"],
  ["summary", "Resumen"]
] as const;

export default async function ExportsPage() {
  const context = await requireInternalArea("ADMIN");
  const { data: branches } = await context.supabase.from("branches").select("id,name").eq("status", "ACTIVE").order("name");
  return (
    <main className="enterprise-page">
      <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Datos</p><h1 id="exports-title">Exportaciones</h1><p>Descarga únicamente la información autorizada para tu alcance.</p></div></header>
      <section className="enterprise-content-card admin-export-card" aria-labelledby="export-form-title">
        <h2 className="admin-card-title" id="export-form-title">Preparar archivo</h2>
        <p className="admin-card-copy">Selecciona el conjunto de datos, periodo y formato.</p>
        <form className="auth-form" method="get" action="/api/admin/exports">
          <label className="field"><span>Tipo</span><select name="type" defaultValue="customers">{exportsList.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="field"><span>Sucursal (opcional)</span><select name="branchId" defaultValue=""><option value="">Todas las permitidas</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <div className="form-grid"><label className="field"><span>Desde</span><input name="from" type="date" /></label><label className="field"><span>Hasta</span><input name="to" type="date" /></label></div>
          <label className="field"><span>Formato</span><select name="format" defaultValue="csv"><option value="csv">CSV</option><option value="xlsx">XLSX</option></select></label>
          <button className="primary-button" type="submit">Descargar archivo</button>
        </form>
      </section>
    </main>
  );
}
