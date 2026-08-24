import Link from "next/link";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { consolidateDraftCards } from "@/lib/admin/cards";
import { requireInternalArea } from "@/lib/auth/server";
import { archiveCard, createCardDraft, deleteCard, restoreCard } from "./actions";

type CardsPageProps = { searchParams: Promise<{
  deactivated?: string;
  deleted?: string;
  discarded?: string;
  error?: string;
  published?: string;
  restored?: string;
}> };
type CardRow = {
  id: string;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  current_step: number;
  updated_at: string;
  program_id: string;
  published_at: string | null;
  program_completed: boolean;
  design_completed: boolean;
  locations_completed: boolean;
};
type CardStats = {
  issued_cards: number | string;
  purchase_count: number | string;
  purchase_amount_minor: number | string;
  units_awarded: number | string;
  rewards_generated: number | string;
  rewards_redeemed: number | string;
};

export default async function CardsPage({ searchParams }: CardsPageProps) {
  const context = await requireInternalArea("ADMIN");
  if (context.access.role !== "ADMIN" || !context.tenantId) redirect("/admin");
  const query = await searchParams;
  const [{ data: tenant }, { data: rawCards, error }] = await Promise.all([
    context.supabase.from("tenants").select("name,currency_code").eq("id", context.tenantId).maybeSingle(),
    context.supabase.from("loyalty_cards").select("id,name,status,current_step,updated_at,program_id,published_at,program_completed,design_completed,locations_completed").eq("tenant_id", context.tenantId).order("updated_at", { ascending: false }),
  ]);
  const cards = consolidateDraftCards((rawCards ?? []) as CardRow[]);
  const activeCards = cards.filter((card) => card.status !== "ARCHIVED");
  const archivedCards = cards.filter((card) => card.status === "ARCHIVED");
  const stats = await Promise.all(cards.map(async (card) => {
    const { data } = await context.supabase.schema("app").rpc("get_loyalty_card_stats", { target_card_id: card.id });
    return [card.id, (Array.isArray(data) ? data[0] : null) as CardStats | null] as const;
  }));
  const statsByCard = new Map(stats);
  const currency = tenant?.currency_code ?? "MXN";
  const money = (value: number | string | undefined) => new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(Number(value ?? 0) / 100);
  const units = (value: number | string | undefined) => Number(value ?? 0).toFixed(1);

  return <main className="enterprise-page">
    <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Configuración · {tenant?.name ?? "Negocio"}</p><h1 id="cards-title">Tarjetas</h1><p>Crea hasta tres experiencias, cada una con programa, diseño, sucursales y métricas propias.</p></div></header>
    {query.published ? <p className="enterprise-alert is-success" role="status">Tarjeta publicada y disponible en sus sucursales.</p> : null}
    {query.discarded ? <p className="enterprise-alert is-success" role="status">Borrador descartado.</p> : null}
    {query.deactivated ? <p className="enterprise-alert is-success" role="status">Tarjeta desactivada. Su historial se conserva.</p> : null}
    {query.restored ? <p className="enterprise-alert is-success" role="status">Tarjeta reactivada.</p> : null}
    {query.deleted ? <p className="enterprise-alert is-success" role="status">Tarjeta eliminada permanentemente.</p> : null}
    {query.error ? <p className="enterprise-alert is-error" role="alert">{query.error}</p> : null}
    {error ? <p className="enterprise-alert is-error" role="alert">No se pudieron cargar las tarjetas. Aplica la migración 0043.</p> : null}
    <section className="enterprise-content-card card-create-panel" aria-labelledby="new-card-title">
      <div><h2 id="new-card-title">Nueva tarjeta</h2><p>El borrador se crea de inmediato y cada etapa queda guardada.</p></div>
      <form action={createCardDraft} className="card-create-form">
        <label className="field"><span>Nombre de la tarjeta</span><input name="name" maxLength={80} placeholder="Ej. Café diario" required /></label>
        <button className="primary-button" disabled={activeCards.length >= 3} type="submit">Crear borrador</button>
      </form>
      <small>{activeCards.length} de 3 tarjetas utilizadas{activeCards.length >= 3 ? " · Límite alcanzado" : ""}</small>
    </section>
    <section className="card-config-grid" aria-labelledby="configured-cards-title">
      <div className="card-section-heading"><h2 id="configured-cards-title">Tarjetas configuradas</h2><p>{activeCards.length} {activeCards.length === 1 ? "tarjeta" : "tarjetas"}</p></div>
      {activeCards.length ? activeCards.map((card) => {
        const cardStats = statsByCard.get(card.id);
        return <article className="card-config-summary" key={card.id}>
          <header><div><span className={`enterprise-badge ${card.status === "PUBLISHED" ? "is-active" : "is-suspended"}`}>{card.status === "PUBLISHED" ? "Publicada" : `Borrador · etapa ${card.current_step} de 4`}</span><h3>{card.name}</h3></div><div className="card-summary-actions"><Link className="secondary-button" href={`/admin/cards/${card.id}/edit?step=${card.current_step}`}>{card.status === "DRAFT" ? "Continuar" : "Editar"}</Link><form action={archiveCard.bind(null, card.id)}><SubmitButton className="danger-button" confirmMessage={card.status === "DRAFT" ? `¿Descartar el borrador “${card.name}”? Podrás recuperarlo desde tarjetas desactivadas.` : `¿Desactivar “${card.name}”? Dejará de admitir registros y operaciones, pero conservará el historial.`}>{card.status === "DRAFT" ? "Descartar" : "Desactivar"}</SubmitButton></form></div></header>
          <dl className="card-config-stats">
            <div><dt>Tarjetas emitidas</dt><dd>{Number(cardStats?.issued_cards ?? 0)}</dd></div>
            <div><dt>Compras</dt><dd>{Number(cardStats?.purchase_count ?? 0)}</dd></div>
            <div><dt>Monto</dt><dd>{money(cardStats?.purchase_amount_minor)}</dd></div>
            <div><dt>Unidades</dt><dd>{units(cardStats?.units_awarded)}</dd></div>
            <div><dt>Recompensas</dt><dd>{Number(cardStats?.rewards_generated ?? 0)}</dd></div>
          </dl>
          <small>Actualizada {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(card.updated_at))}</small>
        </article>;
      }) : <div className="enterprise-empty-state"><h3>Aún no hay tarjetas</h3><p>Crea la primera para configurar su programa y sucursales.</p></div>}
    </section>
    {archivedCards.length ? <section className="card-config-grid card-archived-section" aria-labelledby="archived-cards-title">
      <div className="card-section-heading"><h2 id="archived-cards-title">Tarjetas desactivadas y borradores descartados</h2><p>{archivedCards.length} {archivedCards.length === 1 ? "registro" : "registros"}</p></div>
      {archivedCards.map((card) => {
        const cardStats = statsByCard.get(card.id);
        const wasPublished = Boolean(card.published_at);
        return <article className="card-config-summary is-archived" key={card.id}>
          <header><div><span className="enterprise-badge is-neutral">{wasPublished ? "Desactivada" : "Borrador descartado"}</span><h3>{card.name}</h3></div><div className="card-summary-actions"><form action={restoreCard.bind(null, card.id)}><SubmitButton className="secondary-button">Reactivar</SubmitButton></form><form action={deleteCard.bind(null, card.id)}><SubmitButton className="danger-button" confirmMessage={`¿Eliminar permanentemente “${card.name}”? Esta acción no se puede deshacer y solo procederá si no tiene historial.`}>Eliminar</SubmitButton></form></div></header>
          <p className="card-archived-copy">{Number(cardStats?.issued_cards ?? 0) > 0 ? `Conserva ${Number(cardStats?.issued_cards ?? 0)} tarjeta(s) emitida(s) y no puede eliminarse.` : "Sin tarjetas emitidas. Puede eliminarse permanentemente si tampoco tiene actividad histórica."}</p>
          <small>Actualizada {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(card.updated_at))}</small>
        </article>;
      })}
    </section> : null}
  </main>;
}
