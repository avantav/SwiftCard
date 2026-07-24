import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { confirmCustomerImport, previewCustomerImport } from "../../actions";

type MappingPageProps = { params: Promise<{ importId: string }>; searchParams: Promise<{ preview?: string; confirmed?: string; imported?: string; duplicates?: string; errors?: string }> };

export default async function ImportMappingPage({ params, searchParams }: MappingPageProps) {
  const context = await requireInternalArea("SUPERADMIN");
  const { importId } = await params;
  const query = await searchParams;
  const { data: importRecord } = await context.supabase
    .from("customer_imports")
    .select("id,file_name,file_type,file_size_bytes,status,total_rows,raw_rows,preview_errors,tenant_id")
    .eq("id", importId)
    .maybeSingle();

  if (!importRecord) notFound();
  const rows = Array.isArray(importRecord.raw_rows) ? importRecord.raw_rows as Array<Record<string, string>> : [];
  const headers = Object.keys(rows[0] ?? {});
  const { data: branches } = await context.supabase.from("branches").select("id,name").eq("tenant_id", importRecord.tenant_id).eq("status", "ACTIVE").order("name");

  return (
    <main className="shell">
      <section className="panel" aria-labelledby="mapping-title">
        <Link className="text-link" href="/superadmin/imports">Volver</Link>
        <p className="eyebrow">Importación recibida</p>
        <h1 id="mapping-title" className="form-title">Mapear columnas</h1>
        <p className="body-copy">{importRecord.file_name} quedó registrado. Selecciona qué columna corresponde a cada campo requerido.</p>
        <form className="auth-form" action={previewCustomerImport}>
          <input type="hidden" name="importId" value={importId} />
          <label className="field"><span>Nombre</span><select name="fullName" required><option value="">Selecciona una columna</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>
          <label className="field"><span>Teléfono</span><select name="phone" required><option value="">Selecciona una columna</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>
          <label className="field"><span>Correo (opcional)</span><select name="email"><option value="">Sin correo</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>
          <label className="field"><span>Fecha de nacimiento (opcional)</span><select name="birthDate"><option value="">Sin fecha</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>
          <label className="field"><span>Sellos iniciales (opcional)</span><select name="initialStamps"><option value="">Sin sellos</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>
          <button className="primary-button" type="submit">Previsualizar validación</button>
        </form>
        {query.preview ? <section id="preview" className="notice-panel" aria-labelledby="preview-title"><h2 id="preview-title" className="section-title">Resultado de validación</h2><p>{Array.isArray(importRecord.preview_errors) ? importRecord.preview_errors.length : 0} filas con errores. Ningún cliente fue creado.</p></section> : null}
        {query.confirmed ? <p className="success-alert" role="status">Importados: {query.imported ?? "0"}. Duplicados: {query.duplicates ?? "0"}. Errores: {query.errors ?? "0"}.</p> : null}
        {query.preview && importRecord.status === "PREVIEWED" ? <form className="auth-form" action={confirmCustomerImport}><input type="hidden" name="importId" value={importId} /><label className="field"><span>Sucursal de origen</span><select name="branchId" required defaultValue=""><option value="" disabled>Selecciona una sucursal</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><button className="primary-button" type="submit">Confirmar importación</button></form> : null}
        <dl className="summary-list">
          <div><dt>Estado</dt><dd>{importRecord.status}</dd></div>
          <div><dt>Tipo</dt><dd>{importRecord.file_type}</dd></div>
          <div><dt>Tamaño</dt><dd>{importRecord.file_size_bytes} bytes</dd></div>
          <div><dt>Filas leídas</dt><dd>{importRecord.total_rows}</dd></div>
        </dl>
      </section>
    </main>
  );
}
