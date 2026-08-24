import Link from "next/link";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import {
  CASA_GARMENDIA_EQUIVALENCES,
  CASA_GARMENDIA_IMPORT_PROFILE_CODE,
  CASA_GARMENDIA_IMPORT_PROFILE_NAME,
  isCasaGarmendiaTenantName,
  type CasaGarmendiaImportError,
} from "@/lib/admin/imports";
import { requireInternalArea } from "@/lib/auth/server";
import { confirmCasaGarmendiaImport, uploadCasaGarmendiaImport } from "./actions";

type AdminImportsPageProps = {
  searchParams: Promise<{
    confirmed?: string;
    duplicates?: string;
    error?: string;
    errors?: string;
    importId?: string;
    imported?: string;
    preview?: string;
    rewards?: string;
  }>;
};

type ImportRecord = {
  error_rows: number;
  file_name: string;
  id: string;
  loyalty_card_id: string;
  preview_errors: unknown;
  source_branch_id: string;
  status: "PREVIEWED" | "CONFIRMED" | "FAILED" | "UPLOADED";
  total_rows: number;
};

function previewErrors(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CasaGarmendiaImportError => Boolean(
    item && typeof item === "object" && typeof item.row === "number" && Array.isArray(item.messages),
  ));
}

export default async function AdminImportsPage({ searchParams }: AdminImportsPageProps) {
  const context = await requireInternalArea("ADMIN");
  if (context.access.role !== "ADMIN" || !context.tenantId) redirect("/admin");
  const query = await searchParams;

  const [tenantResult, cardsResult, programsResult, branchesResult, historyResult] = await Promise.all([
    context.supabase.from("tenants").select("name").eq("id", context.tenantId).maybeSingle(),
    context.supabase.from("loyalty_cards").select("id,name,program_id,status").eq("tenant_id", context.tenantId).eq("status", "PUBLISHED").order("name"),
    context.supabase.from("loyalty_programs").select("id,program_type,status").eq("tenant_id", context.tenantId),
    context.supabase.from("branches").select("id,name").eq("tenant_id", context.tenantId).eq("status", "ACTIVE").order("name"),
    context.supabase.from("customer_imports").select("id,file_name,status,total_rows,imported_rows,duplicate_rows,error_rows,created_at").eq("tenant_id", context.tenantId).eq("import_profile_code", CASA_GARMENDIA_IMPORT_PROFILE_CODE).order("created_at", { ascending: false }),
  ]);
  const tenantName = tenantResult.data?.name ?? "Negocio";
  const profileAvailable = isCasaGarmendiaTenantName(tenantName);
  const lifetimeProgramIds = new Set((programsResult.data ?? [])
    .filter((program) => program.program_type === "LIFETIME_POINTS" && program.status === "ACTIVE")
    .map((program) => program.id));
  const cards = (cardsResult.data ?? []).filter((card) => lifetimeProgramIds.has(card.program_id));
  const branches = branchesResult.data ?? [];
  const history = historyResult.data ?? [];
  const profileUsed = history.some((item) => item.status === "CONFIRMED");

  let importRecord: ImportRecord | null = null;
  if (query.importId) {
    const { data } = await context.supabase
      .from("customer_imports")
      .select("id,file_name,status,total_rows,error_rows,preview_errors,loyalty_card_id,source_branch_id")
      .eq("id", query.importId)
      .eq("tenant_id", context.tenantId)
      .eq("import_profile_code", CASA_GARMENDIA_IMPORT_PROFILE_CODE)
      .maybeSingle();
    importRecord = data as ImportRecord | null;
  }
  const errors = previewErrors(importRecord?.preview_errors);
  const selectedCard = cards.find((card) => card.id === importRecord?.loyalty_card_id);
  const selectedBranch = branches.find((branch) => branch.id === importRecord?.source_branch_id);

  return <main className="enterprise-page">
    <header className="enterprise-page-header">
      <div>
        <p className="enterprise-breadcrumb">Datos · {tenantName}</p>
        <h1 id="tenant-imports-title">Importar clientes</h1>
        <p>Convierte una sola vez la base anterior de sellos a la tarjeta de puntos.</p>
      </div>
      <Link className="enterprise-secondary-action" href="/admin/customers">Ver clientes</Link>
    </header>

    {query.confirmed ? <p className="enterprise-alert is-success" role="status">Importación completada: {query.imported ?? "0"} clientes, {query.duplicates ?? "0"} duplicados, {query.errors ?? "0"} errores y {query.rewards ?? "0"} premios asignados.</p> : null}
    {query.error ? <p className="enterprise-alert is-error" role="alert">{query.error}</p> : null}
    {!profileAvailable ? <p className="enterprise-alert is-warning" role="alert">El perfil Casa Garmendia solo está disponible en el tenant correspondiente.</p> : null}
    {profileUsed ? <p className="enterprise-alert is-info" role="status">Este perfil ya fue confirmado. La protección de importación única impide volver a ejecutarlo.</p> : null}

    <section className="enterprise-content-card" aria-labelledby="profile-title">
      <div className="enterprise-panel-header">
        <div><p className="enterprise-breadcrumb">Perfil de importación</p><h2 id="profile-title">{CASA_GARMENDIA_IMPORT_PROFILE_NAME}</h2><p>Columnas esperadas: Nombre, Apellido, Email, Teléfono, Fecha de Nacimiento y Estampillas Actuales.</p></div>
        <span className={`enterprise-badge ${profileUsed ? "is-neutral" : "is-active"}`}>{profileUsed ? "Utilizado" : "Disponible una vez"}</span>
      </div>
      <div className="enterprise-table-wrap">
        <table className="enterprise-table">
          <caption className="sr-only">Equivalencias de sellos anteriores a puntos y premios</caption>
          <thead><tr><th scope="col">Sellos anteriores</th><th scope="col">Puntos importados</th><th scope="col">Premio</th></tr></thead>
          <tbody>{CASA_GARMENDIA_EQUIVALENCES.map((row) => <tr key={`${row.legacyStamps}-${row.reward}`}><td data-label="Sellos anteriores">{row.legacyStamps === 0 ? "Registro" : row.legacyStamps}</td><td className="enterprise-number" data-label="Puntos importados">{row.points}</td><td data-label="Premio">{row.reward}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="enterprise-helper-text">Los valores intermedios conservan el hito mayor alcanzado. Todas las personas importadas reciben el premio de registro.</p>
    </section>

    {profileAvailable && !profileUsed ? <section className="enterprise-content-card" aria-labelledby="upload-title">
      <div><h2 id="upload-title">Preparar archivo</h2><p>La carga solo previsualiza. Ningún cliente se crea hasta confirmar.</p></div>
      <form className="auth-form" action={uploadCasaGarmendiaImport}>
        <label className="field"><span>Tarjeta de puntos</span><select name="loyaltyCardId" required defaultValue=""><option value="" disabled>Selecciona una tarjeta publicada</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select><small>Debe contener hitos en 100, 200, 300, 400, 500, 650 y 860 puntos.</small></label>
        <label className="field"><span>Sucursal de origen</span><select name="sourceBranchId" required defaultValue=""><option value="" disabled>Selecciona una sucursal participante</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <label className="field"><span>Archivo CSV o Excel</span><input name="file" type="file" accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></label>
        {!cards.length ? <p className="enterprise-alert is-warning" role="status">Publica primero una tarjeta de puntos acumulativos.</p> : null}
        {!branches.length ? <p className="enterprise-alert is-warning" role="status">Necesitas al menos una sucursal activa.</p> : null}
        <SubmitButton disabled={!cards.length || !branches.length}>Previsualizar importación</SubmitButton>
      </form>
    </section> : null}

    {importRecord && query.preview ? <section className="enterprise-data-panel" aria-labelledby="preview-title">
      <div className="enterprise-panel-header"><div><h2 id="preview-title">Previsualización</h2><p>{importRecord.file_name}</p></div><span className="enterprise-badge is-suspended">Sin cambios aplicados</span></div>
      <dl className="summary-list">
        <div><dt>Filas leídas</dt><dd>{importRecord.total_rows}</dd></div>
        <div><dt>Listas para importar</dt><dd>{importRecord.total_rows - importRecord.error_rows}</dd></div>
        <div><dt>Con errores</dt><dd>{importRecord.error_rows}</dd></div>
        <div><dt>Destino</dt><dd>{selectedCard?.name ?? "Tarjeta no disponible"} · {selectedBranch?.name ?? "Sucursal no disponible"}</dd></div>
      </dl>
      {errors.length ? <div className="enterprise-alert is-warning" role="alert"><strong>Filas que no se importarán</strong><ul>{errors.slice(0, 20).map((item) => <li key={item.row}>Fila {item.row}: {item.messages.join(" ")}</li>)}</ul>{errors.length > 20 ? <p>Se muestran 20 de {errors.length} filas con error.</p> : null}</div> : <p className="enterprise-alert is-success" role="status">Todas las filas tienen el formato esperado.</p>}
      {importRecord.status === "PREVIEWED" && importRecord.total_rows > importRecord.error_rows ? <form action={confirmCasaGarmendiaImport.bind(null, importRecord.id)}><SubmitButton confirmMessage={`¿Importar permanentemente ${importRecord.total_rows - importRecord.error_rows} clientes? El perfil no podrá utilizarse otra vez.`}>Confirmar importación única</SubmitButton></form> : null}
    </section> : null}

    {history.length ? <section className="enterprise-data-panel" aria-labelledby="history-title"><div className="enterprise-panel-header"><div><h2 id="history-title">Historial del perfil</h2><p>{history.length} {history.length === 1 ? "archivo" : "archivos"}</p></div></div><div className="enterprise-table-wrap"><table className="enterprise-table"><caption className="sr-only">Archivos cargados con el perfil Casa Garmendia</caption><thead><tr><th scope="col">Archivo</th><th scope="col">Estado</th><th scope="col">Filas</th><th scope="col">Importados</th><th scope="col">Duplicados</th><th scope="col">Errores</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td data-label="Archivo">{item.file_name}</td><td data-label="Estado"><span className={`enterprise-badge ${item.status === "CONFIRMED" ? "is-active" : "is-suspended"}`}>{item.status === "CONFIRMED" ? "Confirmada" : "Previsualizada"}</span></td><td className="enterprise-number" data-label="Filas">{item.total_rows}</td><td className="enterprise-number" data-label="Importados">{item.imported_rows}</td><td className="enterprise-number" data-label="Duplicados">{item.duplicate_rows}</td><td className="enterprise-number" data-label="Errores">{item.error_rows}</td></tr>)}</tbody></table></div></section> : null}
  </main>;
}
