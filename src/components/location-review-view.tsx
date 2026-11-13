import Link from "next/link";
import { PurchaseLocationMap, type MapBranchArea, type MapPurchasePoint } from "@/components/purchase-location-map";
import {
  formatDistance,
  LOCATION_RESULTS,
  MAX_REVIEW_DAYS,
  operatorLabel,
  operatorOptions,
  RESULT_BADGES,
  RESULT_LABELS,
  reviewSignals,
  summarizeLocationReview,
  type LocationReviewFilters,
  type LocationReviewRow
} from "@/lib/admin/location-review";

export type LocationReviewBranch = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_meters: number;
};

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

function coordinate(value: number | null) {
  return value === null ? "—" : Number(value).toFixed(6);
}

/** Presentational security view; data and authority come from the page loader. */
export function LocationReviewView({ filters, rows, branches, timeZone, failed, hasFilters, supportMode }: {
  filters: LocationReviewFilters;
  rows: LocationReviewRow[];
  branches: LocationReviewBranch[];
  timeZone: string;
  failed: boolean;
  hasFilters: boolean;
  supportMode: boolean;
}) {
  const header = (
    <header className="enterprise-page-header">
      <div>
        <p className="enterprise-breadcrumb">Datos</p>
        <h1>Seguridad de ubicación</h1>
        <p>Revisa dónde se registró cada compra frente al radio configurado de su sucursal.</p>
      </div>
    </header>
  );

  if (supportMode) {
    return (
      <main className="enterprise-page">
        {header}
        <div className="enterprise-empty-state" role="status">
          <span className="enterprise-empty-icon" aria-hidden="true">!</span>
          <h2>Vista no disponible en modo soporte</h2>
          <p>Solo el Admin general y los administradores de sucursal del negocio pueden consultar ubicaciones.</p>
        </div>
      </main>
    );
  }

  const dateTime = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone });
  const summary = summarizeLocationReview(rows);
  const signals = reviewSignals(rows);
  const operators = operatorOptions(rows, filters.operatorKey);
  const limited = rows.length >= 1000;

  const points: MapPurchasePoint[] = rows.flatMap((row) =>
    row.latitude === null || row.longitude === null ? [] : [{
      id: row.purchase_id,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      outside: row.location_result === "OUTSIDE",
      title: `${RESULT_LABELS[row.location_result]} · ${row.branch_name} · ${operatorLabel(row)} · ticket ${row.ticket_number} · ${formatDistance(row.distance_meters)}`
    }]
  );
  const shownBranchIds = new Set(rows.map((row) => row.branch_id));
  const mapBranches: MapBranchArea[] = branches.flatMap((branch) =>
    branch.latitude === null || branch.longitude === null || (rows.length && !shownBranchIds.has(branch.id)) ? [] : [{
      id: branch.id,
      name: branch.name,
      latitude: Number(branch.latitude),
      longitude: Number(branch.longitude),
      radiusMeters: branch.geofence_radius_meters
    }]
  );
  const mapSummary = `Mapa con ${points.length} compras con coordenadas: ${summary.INSIDE} dentro y ${summary.OUTSIDE} fuera del radio de su sucursal.`;

  return (
    <main className="enterprise-page">
      {header}

      <section className="enterprise-filter-panel" aria-label="Filtros de ubicación">
        <form className="enterprise-filter-form location-review-filters" method="get">
          <label className="field">
            <span>Desde</span>
            <input defaultValue={filters.from} name="from" required type="date" />
          </label>
          <label className="field">
            <span>Hasta</span>
            <input defaultValue={filters.to} name="to" required type="date" />
          </label>
          <label className="field">
            <span>Sucursal</span>
            <select defaultValue={filters.branchId ?? ""} name="branch">
              <option value="">Todas</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Operador</span>
            <select defaultValue={filters.operatorKey ?? ""} name="operator">
              <option value="">Todos</option>
              {operators.map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Resultado</span>
            <select defaultValue={filters.result ?? ""} name="result">
              <option value="">Todos</option>
              {LOCATION_RESULTS.map((result) => <option key={result} value={result}>{RESULT_LABELS[result]}</option>)}
            </select>
          </label>
          <button className="primary-button" type="submit">Aplicar filtros</button>
          {hasFilters ? <Link className="enterprise-secondary-action" href="/admin/security">Limpiar</Link> : null}
        </form>
        <p className="field-hint">Periodo máximo de {MAX_REVIEW_DAYS} días, en la zona horaria del negocio. Cada consulta queda registrada en la auditoría.</p>
      </section>

      {failed ? (
        <div className="enterprise-empty-state is-error" role="alert">
          <span className="enterprise-empty-icon" aria-hidden="true">!</span>
          <h2>No se pudieron cargar las ubicaciones</h2>
          <p>Verifica el periodo seleccionado y vuelve a intentarlo. Si el problema continúa, tu cuenta puede no tener acceso a esta vista.</p>
        </div>
      ) : (
        <>
          <section aria-label="Resumen de ubicaciones" className="enterprise-metrics">
            <article className="enterprise-metric">
              <span>Compras revisadas</span>
              <strong>{summary.total}</strong>
              <small>{limited ? "Mostrando las 1,000 más recientes" : "En el periodo y filtros actuales"}</small>
            </article>
            <article className="enterprise-metric">
              <span>Fuera del radio</span>
              <strong>{summary.OUTSIDE}</strong>
              <small>Requieren revisión</small>
            </article>
            <article className="enterprise-metric">
              <span>Sin coordenadas</span>
              <strong>{summary.NO_COORDINATES}</strong>
              <small>El dispositivo no envió ubicación</small>
            </article>
            <article className="enterprise-metric">
              <span>Sucursal sin punto</span>
              <strong>{summary.NO_BRANCH_POINT}</strong>
              <small>No se puede medir la distancia</small>
            </article>
          </section>

          {signals.length ? (
            <section className="enterprise-data-panel" aria-labelledby="location-signals-title">
              <div className="enterprise-panel-header">
                <div>
                  <h2 id="location-signals-title">Puntos a revisar</h2>
                  <p>Patrones que conviene verificar. Ninguna compra se modifica ni se cancela automáticamente.</p>
                </div>
              </div>
              <ul className="location-review-signals">
                {signals.map((signal) => (
                  <li key={signal.key}>
                    <span className="enterprise-badge is-suspended">Revisar</span>
                    <div><strong>{signal.title}</strong><small>{signal.detail}</small></div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {rows.length ? (
            <section className="enterprise-data-panel location-review-map-panel" aria-labelledby="location-map-title">
              <div className="enterprise-panel-header">
                <div>
                  <h2 id="location-map-title">Mapa de compras</h2>
                  <p>Puntos verdes dentro del radio y rojos fuera. Las áreas grises son el radio de cada sucursal.</p>
                </div>
              </div>
              <PurchaseLocationMap branches={mapBranches} points={points} summary={mapSummary} />
            </section>
          ) : null}

          <section className="enterprise-data-panel" aria-labelledby="location-table-title">
            <div className="enterprise-panel-header">
              <div>
                <h2 id="location-table-title">Compras del periodo</h2>
                <p>{summary.total} {summary.total === 1 ? "compra" : "compras"}{hasFilters ? " con los filtros actuales" : " en los últimos 7 días"}</p>
              </div>
            </div>
            {rows.length ? (
              <div className="enterprise-table-wrap">
                <table className="enterprise-table location-review-table">
                  <caption className="sr-only">Compras con su ubicación registrada y resultado frente al radio de la sucursal</caption>
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Sucursal</th>
                      <th scope="col">Operador</th>
                      <th scope="col">Ticket</th>
                      <th scope="col">Resultado</th>
                      <th scope="col" className="enterprise-number">Distancia</th>
                      <th scope="col"><span className="sr-only">Detalle</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.purchase_id}>
                        <td data-label="Fecha">{dateTime.format(new Date(row.occurred_at))}</td>
                        <td data-label="Sucursal">{row.branch_name}</td>
                        <td data-label="Operador">{operatorLabel(row)}</td>
                        <td data-label="Ticket">{row.ticket_number}{row.purchase_status === "CANCELLED" ? <small className="location-review-cancelled"> · Cancelada</small> : null}</td>
                        <td data-label="Resultado"><span className={`enterprise-badge ${RESULT_BADGES[row.location_result]}`}>{RESULT_LABELS[row.location_result]}</span></td>
                        <td data-label="Distancia" className="enterprise-number">{formatDistance(row.distance_meters)}</td>
                        <td data-label="Detalle">
                          <details className="location-review-detail">
                            <summary>Ver detalle</summary>
                            <dl>
                              <div><dt>Compra</dt><dd><code>{row.purchase_id}</code></dd></div>
                              <div><dt>Estado</dt><dd>{row.purchase_status === "CANCELLED" ? "Cancelada" : "Confirmada"}</dd></div>
                              <div><dt>Importe</dt><dd>{money.format(Number(row.amount_minor) / 100)}</dd></div>
                              <div><dt>Ubicación registrada</dt><dd>{coordinate(row.latitude)}, {coordinate(row.longitude)}</dd></div>
                              <div><dt>Punto de la sucursal</dt><dd>{coordinate(row.branch_latitude)}, {coordinate(row.branch_longitude)}</dd></div>
                              <div><dt>Radio configurado</dt><dd>{row.geofence_radius_meters} m</dd></div>
                            </dl>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="enterprise-empty-state" role="status">
                <span className="enterprise-empty-icon" aria-hidden="true">○</span>
                <h3>{hasFilters ? "Sin compras con estos filtros" : "Sin compras en los últimos 7 días"}</h3>
                <p>{hasFilters ? "Amplía el periodo o limpia los filtros para ver más compras." : "Cuando tu equipo registre compras, aparecerán aquí con su ubicación."}</p>
                {hasFilters ? <Link className="enterprise-secondary-action" href="/admin/security">Limpiar filtros</Link> : null}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
