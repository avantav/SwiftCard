import Link from "next/link";
import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { createCardDraft } from "./actions";

type CardsPageProps = { searchParams: Promise<{ error?: string; published?: string }> };
type CardRow = {
  id: string;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  current_step: number;
  updated_at: string;
  program_id: string;
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
    context.supabase.from("loyalty_cards").select("id,name,status,current_step,updated_at,program_id").eq("tenant_id", context.tenantId).neq("status", "ARCHIVED").order("updated_at", { ascending: false }),
  ]);
  const cards = (rawCards ?? []) as CardRow[];
  const stats = await Promise.all(cards.map(async (card) => {
    const { data } = await context.supabase.schema("app").rpc("get_loyalty_card_stats", { target_card_id: card.id });
    return [card.id, (Array.isArray(data) ? data[0] : null) as CardStats | null] as const;
  }));
  const statsByCard = new Map(stats);
  const currency = tenant?.currency_code ?? "MXN";
  const money = (value: number | string | undefined) => new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(Number(value ?? 0) / 100);

  return <main className="enterprise-page">
    <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Configuración · {tenant?.name ?? "Negocio"}</p><h1 id="cards-title">Tarjetas</h1><p>Crea hasta tres experiencias, cada una con programa, diseño, sucursales y métricas propias.</p></div></header>
    {query.published ? <p className="enterprise-alert is-success" role="status">Tarjeta publicada y disponible en sus sucursales.</p> : null}
    {query.error ? <p className="enterprise-alert is-error" role="alert">{query.error}</p> : null}
    {error ? <p className="enterprise-alert is-error" role="alert">No se pudieron cargar las tarjetas. Aplica la migración 0043.</p> : null}
    <section className="enterprise-content-card card-create-panel" aria-labelledby="new-card-title">
      <div><h2 id="new-card-title">Nueva tarjeta</h2><p>El borrador se crea de inmediato y cada etapa queda guardada.</p></div>
      <form action={createCardDraft} className="card-create-form">
        <label className="field"><span>Nombre de la tarjeta</span><input name="name" maxLength={80} placeholder="Ej. Café diario" required /></label>
        <button className="primary-button" disabled={cards.length >= 3} type="submit">Crear borrador</button>
      </form>
      <small>{cards.length} de 3 tarjetas utilizadas{cards.length >= 3 ? " · Límite alcanzado" : ""}</small>
    </section>
    <section className="card-config-grid" aria-labelledby="configured-cards-title">
      <div className="card-section-heading"><h2 id="configured-cards-title">Tarjetas configuradas</h2><p>{cards.length} {cards.length === 1 ? "tarjeta" : "tarjetas"}</p></div>
      {cards.length ? cards.map((card) => {
        const cardStats = statsByCard.get(card.id);
        return <article className="card-config-summary" key={card.id}>
          <header><div><span className={`enterprise-badge ${card.status === "PUBLISHED" ? "is-active" : "is-suspended"}`}>{card.status === "PUBLISHED" ? "Publicada" : `Borrador · etapa ${card.current_step} de 4`}</span><h3>{card.name}</h3></div><Link className="secondary-button" href={`/admin/cards/${card.id}/edit?step=${card.current_step}`}>{card.status === "DRAFT" ? "Continuar" : "Editar"}</Link></header>
          <dl className="card-config-stats">
            <div><dt>Tarjetas emitidas</dt><dd>{Number(cardStats?.issued_cards ?? 0)}</dd></div>
            <div><dt>Compras</dt><dd>{Number(cardStats?.purchase_count ?? 0)}</dd></div>
            <div><dt>Monto</dt><dd>{money(cardStats?.purchase_amount_minor)}</dd></div>
            <div><dt>Sellos</dt><dd>{Number(cardStats?.units_awarded ?? 0)}</dd></div>
            <div><dt>Recompensas</dt><dd>{Number(cardStats?.rewards_generated ?? 0)}</dd></div>
          </dl>
          <small>Actualizada {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(card.updated_at))}</small>
        </article>;
      }) : <div className="enterprise-empty-state"><h3>Aún no hay tarjetas</h3><p>Crea la primera para configurar su programa y sucursales.</p></div>}
    </section>
  </main>;
}
