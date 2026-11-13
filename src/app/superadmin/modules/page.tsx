import Link from "next/link";
import { requireInternalArea } from "@/lib/auth/server";
import { catalogInDisplayOrder, catalogKeys, getModuleEntry } from "@/lib/modules/catalog";
import { GLOBAL_MODE_COPY, SWITCH_MODE_COPY, effectiveGlobalMode, formatModuleDate, type GlobalMode } from "@/lib/modules/state";

type OverviewRow = {
  module_key: string;
  mode: GlobalMode | null;
  reason: string | null;
  updated_at: string | null;
  plan_tenants: number;
  granted_tenants: number;
  revoked_tenants: number;
  active_tenants: number;
};

type PageProps = { searchParams: Promise<{ error?: string }> };

export default async function ModulesPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  const context = await requireInternalArea("SUPERADMIN");
  const entries = catalogInDisplayOrder();
  const { data, error: loadError } = await context.supabase
    .schema("app")
    .rpc("get_module_overview", { target_keys: catalogKeys() });
  const rows = new Map(((data ?? []) as OverviewRow[]).map((row) => [row.module_key, row]));
  const failed = Boolean(loadError);

  return (
    <main className="enterprise-page">
      <header className="enterprise-page-header">
        <div>
          <p className="enterprise-breadcrumb">Sistema</p>
          <h1>Módulos</h1>
          <p>Activa funciones según el paquete de cada tenant, otórgalas o apágalas en caso de falla.</p>
        </div>
      </header>

      {error ? <p className="enterprise-alert is-error" role="alert"><strong>No se pudo completar la acción.</strong> {error}</p> : null}

      <section aria-labelledby="modules-title" className="enterprise-data-panel">
        <div className="enterprise-panel-header">
          <div>
            <h2 id="modules-title">Catálogo de módulos</h2>
            <p>{failed ? "La información no está disponible." : `${entries.length} ${entries.length === 1 ? "elemento" : "elementos"}`}</p>
          </div>
        </div>

        {failed ? (
          <div className="enterprise-empty-state is-error" role="alert">
            <span className="enterprise-empty-icon" aria-hidden="true">!</span>
            <h3>No se pudieron cargar los módulos</h3>
            <p>Actualiza la página. Si continúa, verifica que la migración 0080 esté aplicada.</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="enterprise-empty-state">
            <h3>Aún no hay módulos</h3>
            <p>Los módulos se declaran en el catálogo del código al agregar una función nueva.</p>
          </div>
        ) : (
          <div className="enterprise-table-wrap">
            <table className="enterprise-table">
              <caption className="sr-only">Módulos y su estado global</caption>
              <thead>
                <tr>
                  <th scope="col">Módulo</th>
                  <th scope="col">Estado global</th>
                  <th scope="col">Tenants activos</th>
                  <th scope="col">Por paquete</th>
                  <th scope="col">Otorgados</th>
                  <th scope="col">Revocados</th>
                  <th scope="col">Último cambio</th>
                  <th scope="col"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const row = rows.get(entry.key);
                  const mode = effectiveGlobalMode(entry.kind, row?.mode ?? null);
                  const copy = entry.kind === "SWITCH" ? SWITCH_MODE_COPY[mode === "OFF" ? "OFF" : "ON"] : GLOBAL_MODE_COPY[mode];
                  const parent = entry.parent ? getModuleEntry(entry.parent) : undefined;
                  return (
                    <tr key={entry.key}>
                      <td data-label="Módulo">
                        <strong>{entry.name}</strong>
                        <br />
                        <small>{parent ? `Parte de ${parent.name}` : entry.key}{entry.availability === "IN_DEVELOPMENT" ? " · En desarrollo" : ""}</small>
                      </td>
                      <td data-label="Estado global"><span className={`enterprise-badge ${copy.badge}`}>{copy.label}</span></td>
                      <td data-label="Tenants activos" className="enterprise-number">{row?.active_tenants ?? 0}</td>
                      <td data-label="Por paquete" className="enterprise-number">{entry.kind === "MODULE" ? row?.plan_tenants ?? 0 : "—"}</td>
                      <td data-label="Otorgados" className="enterprise-number">{entry.kind === "MODULE" ? row?.granted_tenants ?? 0 : "—"}</td>
                      <td data-label="Revocados" className="enterprise-number">{row?.revoked_tenants ?? 0}</td>
                      <td data-label="Último cambio">{row?.updated_at ? formatModuleDate(row.updated_at) : "Sin cambios"}</td>
                      <td className="enterprise-row-actions">
                        <Link className="enterprise-secondary-action" href={`/superadmin/modules/${entry.key}`}>Administrar</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
