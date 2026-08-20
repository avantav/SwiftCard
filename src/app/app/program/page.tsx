import { requireInternalArea } from "@/lib/auth/server";

type RewardTier = {
  description: string;
  expiration_days: number | null;
  name: string;
  stamps_required: number;
};

type ProgramCatalogItem = {
  amount_per_stamp_minor: number | string | null;
  card_name: string;
  carry_remainder: boolean;
  currency_code: string;
  loyalty_card_id: string;
  minimum_purchase_minor: number | string;
  program_name: string;
  program_status: string;
  program_type: "STAMPS_PER_PURCHASE" | "STAMPS_PER_AMOUNT" | "LIFETIME_POINTS";
  reward_tiers: unknown;
  stamps_per_purchase: number;
  terms_and_conditions: string;
  unit_name_plural: string;
  unit_name_singular: string;
};

function tiersFrom(value: unknown): RewardTier[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tier): tier is RewardTier => {
    if (!tier || typeof tier !== "object") return false;
    const item = tier as Record<string, unknown>;
    return typeof item.stamps_required === "number"
      && typeof item.name === "string"
      && typeof item.description === "string"
      && (typeof item.expiration_days === "number" || item.expiration_days === null);
  });
}

function money(value: number | string | null, currency: string) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(Number(value ?? 0) / 100);
}

function earningDescription(program: ProgramCatalogItem) {
  if (program.program_type === "STAMPS_PER_PURCHASE") {
    const units = program.stamps_per_purchase === 1 ? program.unit_name_singular : program.unit_name_plural;
    const minimum = Number(program.minimum_purchase_minor) > 0
      ? ` en compras desde ${money(program.minimum_purchase_minor, program.currency_code)}`
      : " por cada compra";
    return `${program.stamps_per_purchase} ${units}${minimum}.`;
  }
  const amount = money(program.amount_per_stamp_minor, program.currency_code);
  return `1 ${program.unit_name_singular} por cada ${amount}${program.carry_remainder ? "; el monto restante se conserva" : ""}.`;
}

export default async function ProgramPage() {
  const context = await requireInternalArea("APP");
  const { data, error } = await context.supabase.schema("app").rpc("get_staff_program_catalog");
  const programs = (data ?? []) as ProgramCatalogItem[];

  return <main className="operations-page">
    <header className="operations-page-header"><p>Programa</p><h1>Premios y condiciones</h1><span>Consulta cómo se acumulan beneficios, el catálogo vigente y sus términos.</span></header>
    {error ? <p className="operations-alert is-error" role="alert">No se pudo cargar la información del programa. Actualiza la página.</p> : null}
    {!error && !programs.length ? <div className="operations-empty-state"><h2>No hay programas publicados</h2><p>Cuando el negocio publique una tarjeta, sus premios y condiciones aparecerán aquí.</p></div> : null}
    {!error ? <section className="operations-program-list" aria-label="Programas disponibles">
      {programs.map((program, index) => {
        const tiers = tiersFrom(program.reward_tiers);
        return <details className="operations-program-card" key={program.loyalty_card_id} open={programs.length === 1 || index === 0}>
          <summary><span><small>{program.card_name}</small><strong>{program.program_name}</strong></span><span>{tiers.length} {tiers.length === 1 ? "premio" : "premios"}</span></summary>
          <div className="operations-program-content">
            {program.program_status !== "ACTIVE" ? <p className="operations-alert is-error">El programa está pausado; sus condiciones siguen disponibles para consulta.</p> : null}
            <section className="operations-program-how" aria-labelledby={`program-how-${program.loyalty_card_id}`}><h2 id={`program-how-${program.loyalty_card_id}`}>Cómo acumular</h2><p>{earningDescription(program)}</p></section>
            <section aria-labelledby={`program-rewards-${program.loyalty_card_id}`}><h2 id={`program-rewards-${program.loyalty_card_id}`}>Catálogo de premios</h2>{tiers.length ? <ol className="operations-program-rewards">{tiers.map((tier) => <li key={`${tier.stamps_required}-${tier.name}`}><span>{tier.stamps_required}</span><div><strong>{tier.name}</strong><p>{tier.description}</p><small>{tier.stamps_required} {tier.stamps_required === 1 ? program.unit_name_singular : program.unit_name_plural} · {tier.expiration_days ? `Vigencia de ${tier.expiration_days} días` : "Sin vencimiento"}</small></div></li>)}</ol> : <p className="operations-result-note">Este programa todavía no tiene premios publicados.</p>}</section>
            <section className="operations-program-terms" aria-labelledby={`program-terms-${program.loyalty_card_id}`}><h2 id={`program-terms-${program.loyalty_card_id}`}>Términos y condiciones</h2><p>{program.terms_and_conditions}</p></section>
          </div>
        </details>;
      })}
    </section> : null}
  </main>;
}
