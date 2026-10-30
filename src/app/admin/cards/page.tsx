import Link from "next/link";
import { redirect } from "next/navigation";
import { AppleStoreCardPreview } from "@/components/apple-store-card-preview";
import { BranchWorkspaceDialog } from "@/components/branch-workspace-dialog";
import { PendingLinkContent } from "@/components/pending-link-content";
import { SubmitButton } from "@/components/submit-button";
import { consolidateDraftCards } from "@/lib/admin/cards";
import { requireInternalArea } from "@/lib/auth/server";
import { archiveCard, createCardDraft, deleteCard, restoreCard } from "./actions";

type CardsPageProps = { searchParams: Promise<Record<string, string | undefined>> };
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
  background_color: string;
  foreground_color: string;
  label_color: string;
  logo_text: string | null;
  description: string;
  logo_image_url: string | null;
  strip_image_url: string | null;
};
type CardStats = {
  issued_cards: number | string;
  purchase_count: number | string;
  purchase_amount_minor: number | string;
  units_awarded: number | string;
  rewards_generated: number | string;
  rewards_redeemed: number | string;
};
type CardProgram = {
  id: string;
  name: string;
  program_type: "STAMPS_PER_PURCHASE" | "STAMPS_PER_AMOUNT" | "LIFETIME_POINTS";
  unit_name_singular: string;
  unit_name_plural: string;
};

function cardsHref(values: Record<string, string> = {}) {
  const query = new URLSearchParams(values);
  return query.size ? `/admin/cards?${query}` : "/admin/cards";
}

function formatUpdated(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function readiness(card: CardRow) {
  return [
    ["Programa", card.program_completed],
    ["Diseño", card.design_completed],
    ["Sucursales", card.locations_completed],
    ["Publicación", card.status === "PUBLISHED" || Boolean(card.published_at)],
  ] as const;
}

export default async function CardsPage({ searchParams }: CardsPageProps) {
  const context = await requireInternalArea("ADMIN");
  if (context.access.role !== "ADMIN" || !context.tenantId) redirect("/admin");
  const query = await searchParams;
  const [{ data: tenant }, { data: rawCards, error }] = await Promise.all([
    context.supabase.from("tenants").select("name,currency_code,logo_url,banner_url").eq("id", context.tenantId).maybeSingle(),
    context.supabase.from("loyalty_cards").select("id,name,status,current_step,updated_at,program_id,published_at,program_completed,design_completed,locations_completed,background_color,foreground_color,label_color,logo_text,description,logo_image_url,strip_image_url").eq("tenant_id", context.tenantId).order("updated_at", { ascending: false }),
  ]);
  const cards = consolidateDraftCards((rawCards ?? []) as CardRow[]);
  const programIds = [...new Set(cards.map((card) => card.program_id))];
  const [{ data: rawPrograms }, { data: rawTiers }] = programIds.length ? await Promise.all([
    context.supabase.from("loyalty_programs").select("id,name,program_type,unit_name_singular,unit_name_plural").in("id", programIds),
    context.supabase.from("loyalty_reward_tiers").select("program_id,stamps_required").in("program_id", programIds).eq("active", true),
  ]) : [{ data: [] }, { data: [] }];
  const programsById = new Map((rawPrograms ?? []).map((program) => [program.id, program as CardProgram]));
  const activeCards = cards.filter((card) => card.status !== "ARCHIVED");
  const archivedCards = cards.filter((card) => card.status === "ARCHIVED");
  const archivedView = query.view === "archived";
  const visibleCards = archivedView ? archivedCards : activeCards;
  const selectedCard = cards.find((card) => card.id === query.card) ?? null;
  const showCreate = query.view === "create";
  const selectedStatsResult = selectedCard
    ? await context.supabase.schema("app").rpc("get_loyalty_card_stats", { target_card_id: selectedCard.id })
    : { data: null, error: null };
  const selectedStats = (Array.isArray(selectedStatsResult.data) ? selectedStatsResult.data[0] : null) as CardStats | null;
  const currency = tenant?.currency_code ?? "MXN";
  const money = (value: number | string | undefined) => new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(Number(value ?? 0) / 100);
  const units = (value: number | string | undefined) => Number(value ?? 0).toFixed(1);
  const success = query.published || query.discarded || query.deactivated || query.restored || query.deleted;

  return <main className="enterprise-page cards-control-page">
    <header className="enterprise-page-header cards-compact-header"><div><p className="enterprise-breadcrumb">Configuración · {tenant?.name ?? "Negocio"}</p><h1 id="cards-title">Tarjetas</h1><p>Administra las experiencias de fidelidad activas y su configuración.</p></div><div className="cards-header-actions"><span className="cards-capacity">{activeCards.length} de 3 utilizadas</span>{activeCards.length < 3 ? <Link className="enterprise-primary-action" href={cardsHref({ view: "create" })}><PendingLinkContent label="Abriendo alta">Nueva tarjeta</PendingLinkContent></Link> : <span aria-disabled="true" className="enterprise-primary-action is-disabled" title="Archiva una tarjeta para crear otra.">Límite alcanzado</span>}</div></header>

    {success ? <p className="enterprise-alert is-success" role="status">La configuración de tarjetas se actualizó correctamente.</p> : null}
    {query.error ? <p className="enterprise-alert is-error" role="alert">{query.error}</p> : null}
    {error ? <p className="enterprise-alert is-error" role="alert">No se pudieron cargar las tarjetas. Aplica la migración 0043.</p> : null}

    <nav aria-label="Estado de las tarjetas" className="cards-view-nav"><Link aria-current={!archivedView ? "page" : undefined} className={!archivedView ? "is-active" : undefined} href="/admin/cards"><PendingLinkContent>Activas y borradores <span>{activeCards.length}</span></PendingLinkContent></Link><Link aria-current={archivedView ? "page" : undefined} className={archivedView ? "is-active" : undefined} href={cardsHref({ view: "archived" })}><PendingLinkContent>Archivadas <span>{archivedCards.length}</span></PendingLinkContent></Link></nav>

    <section className="enterprise-data-panel cards-inventory-panel" aria-labelledby="cards-inventory-title">
      <div className="enterprise-panel-header cards-inventory-heading"><div><h2 id="cards-inventory-title">{archivedView ? "Tarjetas archivadas" : "Tarjetas actuales"}</h2><p>{visibleCards.length} {visibleCards.length === 1 ? "tarjeta" : "tarjetas"}</p></div></div>
      {visibleCards.length ? <div className="cards-gallery">{visibleCards.map((card) => {
        const wasPublished = Boolean(card.published_at);
        const program = programsById.get(card.program_id);
        const rewardGoal = (rawTiers ?? []).filter((tier) => tier.program_id === card.program_id).reduce((maximum, tier) => Math.max(maximum, Number(tier.stamps_required)), 0) || null;
        const destination = card.status === "DRAFT" ? `/admin/cards/${card.id}/edit?step=${card.current_step}` : cardsHref({ ...(archivedView ? { view: "archived" } : {}), card: card.id });
        return <Link className="cards-gallery-card" href={destination} key={card.id}><PendingLinkContent label={`Abriendo ${card.name}`}><span aria-hidden="true" className="cards-gallery-preview"><AppleStoreCardPreview design={{ logoText: card.logo_text ?? "", backgroundColor: card.background_color, foregroundColor: card.foreground_color, labelColor: card.label_color, logoImageUrl: card.logo_image_url ?? tenant?.logo_url ?? "", stripImageUrl: card.strip_image_url ?? tenant?.banner_url ?? "", logoScalePercent: 100, logoMarginXPercent: 0, logoMarginYPercent: 0, stripScalePercent: 100, stripMarginXPercent: 0, stripMarginYPercent: 0, stripDimmingEnabled: true, stripStampsEnabled: true, stampIconUrl: "", stampEmptySlotsEnabled: true, stampRowCounts: [], stampPositionXPercent: 50, stampPositionYPercent: 50 }} programName={program?.name ?? card.name} programType={program?.program_type ?? "STAMPS_PER_PURCHASE"} rewardGoal={rewardGoal} tenantName={tenant?.name ?? "Negocio"} unitNamePlural={program?.unit_name_plural ?? "sellos"} unitNameSingular={program?.unit_name_singular ?? "sello"} /></span><span className="cards-gallery-meta"><strong>{card.name}</strong><span className={`enterprise-badge ${card.status === "PUBLISHED" ? "is-active" : card.status === "ARCHIVED" ? "is-neutral" : "is-suspended"}`}>{card.status === "PUBLISHED" ? "Publicada" : card.status === "ARCHIVED" ? (wasPublished ? "Desactivada" : "Borrador descartado") : "Borrador"}</span></span></PendingLinkContent></Link>;
      })}</div> : <div className="enterprise-empty-state admin-compact-empty"><h3>{archivedView ? "No hay tarjetas archivadas" : "Crea tu primera tarjeta"}</h3><p>{archivedView ? "Las tarjetas desactivadas y borradores descartados aparecerán aquí." : "Configura programa, diseño y sucursales en cuatro pasos guardados."}</p>{!archivedView && activeCards.length < 3 ? <Link className="enterprise-primary-action" href={cardsHref({ view: "create" })}><PendingLinkContent>Nueva tarjeta</PendingLinkContent></Link> : null}</div>}
    </section>

    {showCreate || selectedCard ? <BranchWorkspaceDialog closeHref={selectedCard?.status === "ARCHIVED" ? cardsHref({ view: "archived" }) : "/admin/cards"} labelledBy="card-workspace-title">{showCreate ? <div className="enterprise-content-card card-menu-dialog"><div className="branch-workspace-heading"><div><p className="enterprise-breadcrumb">Nueva experiencia</p><h2 id="card-workspace-title">Crear tarjeta</h2><p>El borrador se guardará de inmediato y podrás terminarlo después.</p></div><Link className="enterprise-secondary-action" href="/admin/cards">Cancelar</Link></div><form action={createCardDraft} className="auth-form card-menu-create-form"><label className="field"><span>Nombre de la tarjeta</span><input autoFocus name="name" maxLength={80} placeholder="Ej. Café diario" required /></label><SubmitButton>Crear y configurar</SubmitButton></form></div> : selectedCard ? <div className="enterprise-data-panel branch-workspace-panel card-menu-dialog"><div className="branch-workspace-heading"><div><p className="enterprise-breadcrumb">{selectedCard.status === "PUBLISHED" ? "Tarjeta publicada" : selectedCard.status === "ARCHIVED" ? "Archivo" : "Configuración pendiente"}</p><h2 id="card-workspace-title">{selectedCard.name}</h2><p>Actualizada {formatUpdated(selectedCard.updated_at)}</p></div><Link className="enterprise-secondary-action" href={selectedCard.status === "ARCHIVED" ? cardsHref({ view: "archived" }) : "/admin/cards"}>Cerrar</Link></div><div className="branch-workspace-body card-menu-summary">
          <section><div className="branch-wizard-step-heading"><h3>Preparación</h3><p>Estado de las cuatro etapas necesarias para operar.</p></div><ol className="card-readiness-list is-detailed">{readiness(selectedCard).map(([label, complete]) => <li className={complete ? "is-complete" : undefined} key={label}><span aria-hidden="true">{complete ? "✓" : "·"}</span>{label}</li>)}</ol></section>
          {selectedStatsResult.error ? <p className="enterprise-alert is-error" role="alert">No se pudieron cargar las métricas de esta tarjeta.</p> : <section><div className="branch-wizard-step-heading"><h3>Actividad</h3><p>Resumen histórico exclusivo de esta tarjeta.</p></div><dl className="card-menu-stats"><div><dt>Emitidas</dt><dd>{Number(selectedStats?.issued_cards ?? 0)}</dd></div><div><dt>Compras</dt><dd>{Number(selectedStats?.purchase_count ?? 0)}</dd></div><div><dt>Monto</dt><dd>{money(selectedStats?.purchase_amount_minor)}</dd></div><div><dt>Unidades</dt><dd>{units(selectedStats?.units_awarded)}</dd></div><div><dt>Generadas</dt><dd>{Number(selectedStats?.rewards_generated ?? 0)}</dd></div><div><dt>Canjeadas</dt><dd>{Number(selectedStats?.rewards_redeemed ?? 0)}</dd></div></dl></section>}
          <section className="card-menu-lifecycle"><div className="branch-wizard-step-heading"><h3>Acciones</h3><p>{selectedCard.status === "ARCHIVED" ? "Puedes recuperar esta tarjeta; la eliminación solo procede sin historial." : "La edición abre el asistente y conserva todo lo guardado."}</p></div><div>{selectedCard.status === "ARCHIVED" ? <><form action={restoreCard.bind(null, selectedCard.id)}><SubmitButton className="secondary-button">Reactivar</SubmitButton></form><form action={deleteCard.bind(null, selectedCard.id)}><SubmitButton className="danger-button" confirmMessage={`¿Eliminar permanentemente “${selectedCard.name}”? Esta acción no se puede deshacer y solo procederá si no tiene historial.`}>Eliminar permanentemente</SubmitButton></form></> : <><Link className="enterprise-primary-action" href={`/admin/cards/${selectedCard.id}/edit?step=${selectedCard.current_step}`}><PendingLinkContent>Abrir editor</PendingLinkContent></Link><form action={archiveCard.bind(null, selectedCard.id)}><SubmitButton className="danger-button" confirmMessage={selectedCard.status === "DRAFT" ? `¿Descartar el borrador “${selectedCard.name}”? Podrás recuperarlo desde tarjetas archivadas.` : `¿Desactivar “${selectedCard.name}”? Dejará de admitir registros y operaciones, pero conservará el historial.`}>{selectedCard.status === "DRAFT" ? "Descartar borrador" : "Desactivar tarjeta"}</SubmitButton></form></>}</div></section>
        </div></div> : null}</BranchWorkspaceDialog> : null}
  </main>;
}
