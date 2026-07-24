import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";

type MappingPageProps = { params: Promise<{ importId: string }> };

export default async function ImportMappingPage({ params }: MappingPageProps) {
  const context = await requireInternalArea("SUPERADMIN");
  const { importId } = await params;
  const { data: importRecord } = await context.supabase
    .from("customer_imports")
    .select("id,file_name,file_type,file_size_bytes,status,total_rows,raw_rows")
    .eq("id", importId)
    .maybeSingle();

  if (!importRecord) notFound();
  const rows = Array.isArray(importRecord.raw_rows) ? importRecord.raw_rows as Array<Record<string, string>> : [];
  const headers = Object.keys(rows[0] ?? {});

  return (
    <main className="shell">
      <section className="panel" aria-labelledby="mapping-title">
        <Link className="text-link" href="/superadmin/imports">Volver</Link>
        <p className="eyebrow">Importación recibida</p>
        <h1 id="mapping-title" className="form-title">Mapear columnas</h1>
        <p className="body-copy">{importRecord.file_name} quedó registrado. Selecciona qué columna corresponde a cada campo requerido.</p>
        <form className="auth-form" action="#preview">
          <label className="field"><span>Nombre</span><select name="fullName" required><option value="">Selecciona una columna</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>
          <label className="field"><span>Teléfono</span><select name="phone" required><option value="">Selecciona una columna</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>
          <label className="field"><span>Correo (opcional)</span><select name="email"><option value="">Sin correo</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>
          <button className="primary-button" type="submit">Previsualizar validación</button>
        </form>
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
