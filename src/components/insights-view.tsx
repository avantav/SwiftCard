import Link from "next/link";
import type { CSSProperties } from "react";
import {
  averageTicket,
  busiestSlot,
  describeChange,
  formatPercent,
  heatmapGrid,
  PERIOD_PRESETS,
  ratio,
  returnRate,
  SEGMENT_COPY,
  type AdvancedCustomerInsights,
  type CustomerInsights,
  type InsightsFilters
} from "@/lib/admin/insights";

type Branch = { id: string; name: string };

const shortDate = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function Change({ change }: { change: ReturnType<typeof describeChange> }) {
  if (!change) return <small>Sin periodo anterior para comparar</small>;
  const symbol = change.direction === "up" ? "▲" : change.direction === "down" ? "▼" : "■";
  return <small className={`insights-change is-${change.direction}`}><span aria-hidden="true">{symbol} </span>{change.text}</small>;
}

function query(filters: InsightsFilters, overrides: Record<string, string | null>) {
  const params = new URLSearchParams();
  const values: Record<string, string | null> = {
    period: filters.preset ? String(filters.preset) : null,
    from: filters.preset ? null : filters.from,
    to: filters.preset ? null : filters.to,
    branch: filters.branchId,
    ...overrides
  };
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function InsightsView({ insights, filters, branches, currency, failed }: {
  insights: CustomerInsights | null;
  filters: InsightsFilters;
  branches: Branch[];
  currency: string;
  failed: boolean;
}) {
  const money = new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 0 });
  const formatMoney = (minor: number | null) => (minor === null ? "—" : money.format(minor / 100));

  return (
    <>
      <header className="enterprise-page-header">
        <div>
          <p className="enterprise-breadcrumb">Operación</p>
          <h1>Estadísticas de clientes</h1>
          <p>Consulta cuántos clientes vuelven y cómo rinde tu programa en el periodo.</p>
        </div>
      </header>

      <section className="enterprise-filter-panel" aria-label="Filtros de estadísticas">
        <nav className="insights-presets" aria-label="Periodo">
          {PERIOD_PRESETS.map((days) => (
            <Link
              aria-current={filters.preset === days ? "page" : undefined}
              className={`insights-preset${filters.preset === days ? " is-active" : ""}`}
              href={`/admin/dashboard${query(filters, { period: String(days), from: null, to: null })}`}
              key={days}
            >
              Últimos {days} días
            </Link>
          ))}
        </nav>
        <form className="enterprise-filter-form insights-filters" method="get">
          <label className="field"><span>Desde</span><input defaultValue={filters.from} name="from" required type="date" /></label>
          <label className="field"><span>Hasta</span><input defaultValue={filters.to} name="to" required type="date" /></label>
          <label className="field">
            <span>Sucursal</span>
            <select defaultValue={filters.branchId ?? ""} name="branch">
              <option value="">Todas las permitidas</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <button className="primary-button" type="submit">Aplicar filtros</button>
        </form>
      </section>

      {failed || !insights ? (
        <div className="enterprise-empty-state is-error" role="alert">
          <span className="enterprise-empty-icon" aria-hidden="true">!</span>
          <h2>No se pudieron cargar las estadísticas</h2>
          <p>Revisa el periodo y la sucursal seleccionados y vuelve a intentarlo.</p>
        </div>
      ) : insights.advanced
        ? <InsightsBody filters={filters} formatMoney={formatMoney} insights={insights} />
        : <BasicInsightsBody filters={filters} formatMoney={formatMoney} insights={insights} />}
    </>
  );
}

function SummarySection({ insights, filters, formatMoney }: {
  insights: CustomerInsights;
  filters: InsightsFilters;
  formatMoney: (minor: number | null) => string;
}) {
  const { summary, previous } = insights;
  return (
    <>
      <section aria-label="Resumen del periodo" className="enterprise-metrics">
        <article className="enterprise-metric">
          <span>Clientes activos</span>
          <strong>{summary.active_customers}</strong>
          <Change change={describeChange(summary.active_customers, previous.active_customers, "count")} />
        </article>
        <article className="enterprise-metric">
          <span>Tasa de retorno</span>
          <strong>{formatPercent(returnRate(summary))}</strong>
          <Change change={describeChange(returnRate(summary), returnRate(previous), "rate")} />
        </article>
        <article className="enterprise-metric">
          <span>Clientes nuevos</span>
          <strong>{summary.new_customers}</strong>
          <Change change={describeChange(summary.new_customers, previous.new_customers, "count")} />
        </article>
        <article className="enterprise-metric">
          <span>Ticket promedio</span>
          <strong className="enterprise-metric-text">{formatMoney(averageTicket(summary))}</strong>
          <Change change={describeChange(averageTicket(summary), averageTicket(previous), "count")} />
        </article>
      </section>
      <p className="field-hint insights-definition">
        <strong>Tasa de retorno:</strong> de los {summary.active_customers} clientes que compraron en el periodo, {summary.returning_customers} ya habían venido antes o vinieron más de una vez. Periodo del {longDate.format(new Date(`${filters.from}T00:00:00Z`))} al {longDate.format(new Date(`${filters.to}T00:00:00Z`))}.
      </p>
    </>
  );
}

function RewardsStats({ insights }: { insights: CustomerInsights }) {
  const redemptionRate = ratio(insights.rewards.redeemed, insights.rewards.generated);
  return (
    <dl className="insights-stats">
      <div><dt>Ganados</dt><dd>{insights.rewards.generated}</dd></div>
      <div><dt>Canjeados</dt><dd>{insights.rewards.redeemed}</dd></div>
      <div><dt>Tasa de canje</dt><dd>{formatPercent(redemptionRate)}</dd></div>
      <div><dt>Pendientes de canjear hoy</dt><dd>{insights.rewards.pending}</dd></div>
    </dl>
  );
}

/** Basic plans: period summary, rewards and what Empresarial adds (DEC-0069). */
function BasicInsightsBody({ insights, filters, formatMoney }: {
  insights: CustomerInsights;
  filters: InsightsFilters;
  formatMoney: (minor: number | null) => string;
}) {
  return (
    <>
      <SummarySection filters={filters} formatMoney={formatMoney} insights={insights} />
      <section className="enterprise-data-panel" aria-labelledby="rewards-title">
        <div className="enterprise-panel-header">
          <div>
            <h2 id="rewards-title">Premios</h2>
            <p>Premios del programa en el periodo.</p>
          </div>
        </div>
        <RewardsStats insights={insights} />
      </section>
      <section className="enterprise-data-panel" aria-labelledby="advanced-title">
        <div className="enterprise-panel-header">
          <div>
            <h2 id="advanced-title">Estadísticas avanzadas</h2>
            <p>Disponibles en el plan Empresarial.</p>
          </div>
          <span className="enterprise-badge is-neutral">Plan Empresarial</span>
        </div>
        <ul className="insights-upsell">
          <li><strong>Segmentos de clientes</strong><small>Quiénes son frecuentes, quiénes están en riesgo y quiénes ya no vuelven, con su lista de clientes.</small></li>
          <li><strong>Embudo de retorno</strong><small>Cuántos clientes llegan a su segunda y tercera compra.</small></li>
          <li><strong>Visitas por semana y horarios</strong><small>Clientes que regresan frente a primeras compras, y los días y horas con más visitas.</small></li>
          <li><strong>Mejores clientes y comparación por sucursal</strong><small>Top 10 por visitas y gasto, y retorno por sucursal.</small></li>
        </ul>
        <p className="insights-upsell-note">Escríbenos por WhatsApp para activar el plan Empresarial, que también incluye campañas por correo y Wallet.</p>
      </section>
    </>
  );
}

function InsightsBody({ insights, filters, formatMoney }: {
  insights: AdvancedCustomerInsights;
  filters: InsightsFilters;
  formatMoney: (minor: number | null) => string;
}) {
  const totalCustomers = insights.segments.reduce((sum, item) => sum + Number(item.customers), 0);
  const maxSegment = Math.max(1, ...insights.segments.map((item) => Number(item.customers)));
  const funnelSteps = [
    { label: "Registrados", value: insights.funnel.registered },
    { label: "1 compra o más", value: insights.funnel.purchased_1 },
    { label: "Volvieron (2 o más)", value: insights.funnel.purchased_2 },
    { label: "Habituales (3 o más)", value: insights.funnel.purchased_3 }
  ];
  const weeklyMax = Math.max(1, ...insights.weekly.map((week) => Number(week.new_visits) + Number(week.returning_visits)));
  const weeklyTotal = insights.weekly.reduce((sum, week) => sum + Number(week.new_visits) + Number(week.returning_visits), 0);
  const grid = heatmapGrid(insights.heatmap);
  const busiest = busiestSlot(insights.heatmap);
  const isAdmin = insights.role === "ADMIN";

  return (
    <>
      <SummarySection filters={filters} formatMoney={formatMoney} insights={insights} />

      <section className="enterprise-data-panel" aria-labelledby="segments-title">
        <div className="enterprise-panel-header">
          <div>
            <h2 id="segments-title">Segmentos de clientes</h2>
            <p>{totalCustomers} clientes clasificados al cierre del periodo. Cada cliente aparece en un solo segmento.</p>
          </div>
        </div>
        <ul className="insights-segments">
          {insights.segments.map((item) => {
            const copy = SEGMENT_COPY[item.segment];
            const share = ratio(Number(item.customers), totalCustomers);
            return (
              <li key={item.segment}>
                <div className="insights-segment-name">
                  <strong>{copy.label}</strong>
                  <small>{copy.rule}</small>
                </div>
                <div className="insights-bar-track" aria-hidden="true">
                  <span className="insights-bar" style={{ "--size": `${(Number(item.customers) / maxSegment) * 100}%` } as CSSProperties} />
                </div>
                <div className="insights-segment-values">
                  <strong>{item.customers}</strong>
                  <small>{formatPercent(share)} · {formatMoney(Number(item.spend_minor))} gastado</small>
                </div>
                <div className="insights-segment-action">
                  {isAdmin && Number(item.customers) > 0 ? (
                    <Link className="enterprise-secondary-action" href={`/admin/dashboard/segmentos/${item.segment.toLowerCase()}${query(filters, { period: null, from: null, to: null })}`}>
                      Ver clientes<span className="sr-only"> del segmento {copy.label}</span>
                    </Link>
                  ) : <small>{copy.action}</small>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="insights-grid">
        <section className="enterprise-data-panel" aria-labelledby="funnel-title">
          <div className="enterprise-panel-header">
            <div>
              <h2 id="funnel-title">Embudo de retorno</h2>
              <p>Cuántos de tus clientes llegan a cada compra.</p>
            </div>
          </div>
          <ol className="insights-funnel">
            {funnelSteps.map((step, index) => {
              const fromPrevious = index > 0 ? ratio(step.value, funnelSteps[index - 1]!.value) : null;
              return (
                <li key={step.label}>
                  <div className="insights-funnel-label">
                    <span>{step.label}</span>
                    <strong>{step.value}</strong>
                  </div>
                  <div className="insights-bar-track" aria-hidden="true">
                    <span className="insights-bar" style={{ "--size": `${(ratio(step.value, funnelSteps[0]!.value) ?? 0) * 100}%` } as CSSProperties} />
                  </div>
                  {fromPrevious !== null ? <small>{formatPercent(fromPrevious)} del paso anterior</small> : <small>Base del embudo</small>}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="enterprise-data-panel" aria-labelledby="rewards-title">
          <div className="enterprise-panel-header">
            <div>
              <h2 id="rewards-title">Premios</h2>
              <p>Premios del programa en el periodo.</p>
            </div>
          </div>
          <RewardsStats insights={insights} />
        </section>
      </div>

      <section className="enterprise-data-panel" aria-labelledby="weekly-title">
        <div className="enterprise-panel-header">
          <div>
            <h2 id="weekly-title">Visitas por semana</h2>
            <p>Últimas 12 semanas. Compras de clientes que regresan frente a primeras compras.</p>
          </div>
          <ul className="insights-legend" aria-label="Leyenda">
            <li><span className="insights-swatch is-returning" aria-hidden="true" />Regresan</li>
            <li><span className="insights-swatch is-new" aria-hidden="true" />Primera compra</li>
          </ul>
        </div>
        {weeklyTotal ? (
          <>
            <div className="insights-weekly" role="img" aria-label={`Visitas por semana, máximo de ${weeklyMax} en una semana. La tabla siguiente contiene los datos.`}>
              <span className="insights-axis-max" aria-hidden="true">{weeklyMax}</span>
              {insights.weekly.map((week) => {
                const total = Number(week.new_visits) + Number(week.returning_visits);
                const label = shortDate.format(new Date(`${week.week_start}T00:00:00Z`));
                return (
                  <div className="insights-week" key={week.week_start} tabIndex={0} aria-label={`Semana del ${label}: ${week.returning_visits} regresan, ${week.new_visits} primera compra`}>
                    <div className="insights-week-stack" style={{ "--size": `${(total / weeklyMax) * 100}%` } as CSSProperties}>
                      {Number(week.returning_visits) ? <span className="insights-week-part is-returning" style={{ flexGrow: Number(week.returning_visits) }} /> : null}
                      {Number(week.new_visits) ? <span className="insights-week-part is-new" style={{ flexGrow: Number(week.new_visits) }} /> : null}
                    </div>
                    <span className="insights-week-label">{label}</span>
                    <span className="insights-tooltip" role="presentation">
                      <strong>Semana del {label}</strong>
                      <span>Regresan: {week.returning_visits}</span>
                      <span>Primera compra: {week.new_visits}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <details className="insights-data">
              <summary>Ver datos por semana</summary>
              <table className="enterprise-table">
                <caption className="sr-only">Visitas por semana</caption>
                <thead><tr><th scope="col">Semana</th><th scope="col" className="enterprise-number">Regresan</th><th scope="col" className="enterprise-number">Primera compra</th></tr></thead>
                <tbody>
                  {insights.weekly.map((week) => (
                    <tr key={week.week_start}><td data-label="Semana">{shortDate.format(new Date(`${week.week_start}T00:00:00Z`))}</td><td data-label="Regresan" className="enterprise-number">{week.returning_visits}</td><td data-label="Primera compra" className="enterprise-number">{week.new_visits}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        ) : <p className="insights-empty">Aún no hay compras en las últimas 12 semanas.</p>}
      </section>

      <section className="enterprise-data-panel insights-heatmap-panel" aria-labelledby="heatmap-title">
        <div className="enterprise-panel-header">
          <div>
            <h2 id="heatmap-title">Cuándo vienen tus clientes</h2>
            <p>{busiest ? `Compras del periodo por día y hora. Momento con más visitas: ${busiest}.` : "Compras del periodo por día y hora."}</p>
          </div>
        </div>
        {grid.hours.length ? (
          <div className="enterprise-table-wrap insights-heatmap-wrap">
            <table className="insights-heatmap">
              <caption className="sr-only">Número de compras por día de la semana y hora</caption>
              <thead>
                <tr><th scope="col"><span className="sr-only">Día</span></th>{grid.hours.map((hour) => <th key={hour} scope="col">{hour}h</th>)}</tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => (
                  <tr key={row.day}>
                    <th scope="row">{row.day}</th>
                    {row.values.map((value, index) => {
                      const level = grid.max ? value / grid.max : 0;
                      return (
                        <td
                          className={level > 0.55 ? "is-strong" : undefined}
                          key={grid.hours[index]}
                          style={{ "--level": level.toFixed(2) } as CSSProperties}
                          title={`${row.day} ${grid.hours[index]}:00 · ${value} ${value === 1 ? "compra" : "compras"}`}
                        >
                          {value || ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="insights-empty">Sin compras en el periodo.</p>}
      </section>

      <div className="insights-grid">
        {isAdmin ? (
          <section className="enterprise-data-panel" aria-labelledby="top-title">
            <div className="enterprise-panel-header">
              <div>
                <h2 id="top-title">Mejores clientes</h2>
                <p>Top 10 por visitas en el periodo.</p>
              </div>
            </div>
            {insights.top_customers.length ? (
              <div className="enterprise-table-wrap">
                <table className="enterprise-table">
                  <caption className="sr-only">Clientes con más visitas en el periodo</caption>
                  <thead><tr><th scope="col">Cliente</th><th scope="col" className="enterprise-number">Visitas</th><th scope="col" className="enterprise-number">Gasto</th></tr></thead>
                  <tbody>
                    {insights.top_customers.map((customer) => (
                      <tr key={customer.customer_id}><td data-label="Cliente">{customer.full_name}</td><td data-label="Visitas" className="enterprise-number">{customer.visits}</td><td data-label="Gasto" className="enterprise-number">{formatMoney(Number(customer.spend_minor))}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="insights-empty">Sin compras en el periodo.</p>}
          </section>
        ) : null}

        <section className="enterprise-data-panel" aria-labelledby="branches-title">
          <div className="enterprise-panel-header">
            <div>
              <h2 id="branches-title">Por sucursal</h2>
              <p>Clientes activos y retorno en el periodo.</p>
            </div>
          </div>
          {insights.branches.length ? (
            <div className="enterprise-table-wrap">
              <table className="enterprise-table">
                <caption className="sr-only">Comparación por sucursal</caption>
                <thead><tr><th scope="col">Sucursal</th><th scope="col" className="enterprise-number">Activos</th><th scope="col" className="enterprise-number">Retorno</th><th scope="col" className="enterprise-number">Ticket promedio</th></tr></thead>
                <tbody>
                  {insights.branches.map((branch) => (
                    <tr key={branch.branch_id}>
                      <td data-label="Sucursal">{branch.branch_name}</td>
                      <td data-label="Activos" className="enterprise-number">{branch.active_customers}</td>
                      <td data-label="Retorno" className="enterprise-number">{formatPercent(ratio(Number(branch.returning_customers), Number(branch.active_customers)))}</td>
                      <td data-label="Ticket promedio" className="enterprise-number">{formatMoney(Number(branch.purchases) ? Math.round(Number(branch.revenue_minor) / Number(branch.purchases)) : null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="insights-empty">Sin sucursales activas en tu alcance.</p>}
        </section>
      </div>
    </>
  );
}
