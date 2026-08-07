import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { RewardTiersEditor } from "@/components/reward-tiers-editor";
import { requireInternalArea } from "@/lib/auth/server";
import {
  formatMinorUnitsForInput,
  getCurrencyFractionDigits,
} from "@/lib/admin/program";
import { saveLoyaltyProgram } from "./actions";

type ProgramPageProps = {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    status?: string;
  }>;
};

type ProgramRow = {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED";
  rule_type: "PER_PURCHASE" | "PER_AMOUNT";
  minimum_purchase_minor: number | string;
  stamps_per_purchase: number;
  amount_per_stamp_minor: number | string | null;
  carry_remainder: boolean;
  reward_stamp_goal: number;
  reward_name: string;
  reward_description: string;
  reward_expiration_days: number | null;
  terms_and_conditions: string;
  version: number;
};

type RewardTierRow = {
  id: string;
  stamps_required: number;
  name: string;
  description: string;
  expiration_days: number | null;
};

export default async function ProgramPage({ searchParams }: ProgramPageProps) {
  const context = await requireInternalArea("ADMIN");

  if (context.access.role !== "ADMIN" || !context.tenantId) {
    redirect("/admin");
  }

  const params = await searchParams;
  const [
    { data: tenant, error: tenantError },
    { data: rawProgram, error: programError },
  ] = await Promise.all([
      context.supabase
        .from("tenants")
        .select("name,currency_code")
        .eq("id", context.tenantId)
        .maybeSingle(),
      context.supabase
        .from("loyalty_programs")
        .select(
          "id,name,status,rule_type,minimum_purchase_minor,stamps_per_purchase,amount_per_stamp_minor,carry_remainder,reward_stamp_goal,reward_name,reward_description,reward_expiration_days,terms_and_conditions,version",
        )
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
  ]);

  const program = rawProgram as ProgramRow | null;
  const { data: rawTiers, error: tiersError } = program
    ? await context.supabase
        .from("loyalty_reward_tiers")
        .select("id,stamps_required,name,description,expiration_days")
        .eq("program_id", program.id)
        .eq("active", true)
        .order("stamps_required")
    : { data: [], error: null };

  if (tenantError || !tenant?.currency_code || programError || tiersError) {
    return (
      <main className="enterprise-page">
        <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Configuración</p><h1 id="program-title">Programa de fidelidad</h1><p>Define cómo se acumulan sellos y se generan recompensas.</p></div></header>
        <section className="enterprise-content-card admin-program-card" aria-labelledby="program-title">
          <p className="enterprise-alert is-error" role="alert">
            No se pudo cargar de forma segura la configuración del programa.
          </p>
        </section>
      </main>
    );
  }

  const currencyCode = tenant.currency_code;
  const fractionDigits = getCurrencyFractionDigits(currencyCode);
  const moneyStep =
    fractionDigits === 0 ? "1" : `0.${"0".repeat(fractionDigits - 1)}1`;
  const rewardTiers = (rawTiers ?? []) as RewardTierRow[];
  const defaultAmountPerStamp = formatMinorUnitsForInput(
    100 * 10 ** fractionDigits,
    currencyCode,
  );

  return (
    <main className="enterprise-page">
      <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Configuración · {tenant?.name ?? "Tenant"}</p><h1 id="program-title">Programa de fidelidad</h1><p>Define cómo se acumulan sellos y se generan recompensas.</p></div></header>
      <section className="enterprise-content-card admin-program-card" aria-labelledby="program-title">
        <p className="admin-card-copy">
          El backend calculará siempre los sellos y recompensas. Los importes se
          guardan en unidades mínimas de {currencyCode}.
        </p>

        {params.saved ? (
          <p className="enterprise-alert is-success" role="status">
            Programa guardado
            {params.status === "PAUSED" ? " y pausado." : " y activo."}
          </p>
        ) : null}
        {params.error ? (
          <p className="enterprise-alert is-error" role="alert">
            {params.error}
          </p>
        ) : null}
        {program ? (
          <dl className="admin-status-summary">
            <div>
              <dt>Estado actual</dt>
              <dd>{program.status === "ACTIVE" ? "Activo" : "Pausado"}</dd>
            </div>
            <div>
              <dt>Versión</dt>
              <dd>{program.version}</dd>
            </div>
            <div>
              <dt>Niveles</dt>
              <dd>{rewardTiers.length}</dd>
            </div>
          </dl>
        ) : null}

        <form className="auth-form" action={saveLoyaltyProgram}>
          {program ? (
            <input name="programId" type="hidden" value={program.id} />
          ) : null}

          <label className="field">
            <span>Nombre del programa</span>
            <input
              name="name"
              maxLength={120}
              defaultValue={program?.name ?? "Programa de lealtad"}
              required
            />
          </label>

          <div className="form-grid">
            <label className="field">
              <span>Estado</span>
              <select name="status" defaultValue={program?.status ?? "ACTIVE"}>
                <option value="ACTIVE">Activo</option>
                <option value="PAUSED">Pausado</option>
              </select>
            </label>
            <label className="field">
              <span>Regla de acumulación</span>
              <select
                name="ruleType"
                defaultValue={program?.rule_type ?? "PER_PURCHASE"}
              >
                <option value="PER_PURCHASE">Por compra</option>
                <option value="PER_AMOUNT">Por monto</option>
              </select>
            </label>
          </div>

          <div className="admin-form-section"><h2 className="section-title">Regla por compra</h2>
          <p className="field-hint">
            Estos valores se usan solamente cuando la regla seleccionada es por
            compra.
          </p>
          <div className="form-grid">
            <label className="field">
              <span>Monto mínimo ({currencyCode})</span>
              <input
                name="minimumPurchase"
                type="number"
                inputMode="decimal"
                min="0"
                step={moneyStep}
                defaultValue={formatMinorUnitsForInput(
                  program?.minimum_purchase_minor ?? 0,
                  currencyCode,
                )}
                required
              />
            </label>
            <label className="field">
              <span>Sellos por compra</span>
              <input
                name="stampsPerPurchase"
                type="number"
                min={1}
                max={1_000_000}
                defaultValue={program?.stamps_per_purchase ?? 1}
                required
              />
            </label>
          </div>

          </div>

          <div className="admin-form-section"><h2 className="section-title">Regla por monto</h2>
          <p className="field-hint">
            Este importe se usa solamente cuando la regla seleccionada es por
            monto.
          </p>
          <label className="field">
            <span>Monto por sello ({currencyCode})</span>
            <input
              name="amountPerStamp"
              type="number"
              inputMode="decimal"
              min={moneyStep}
              step={moneyStep}
              defaultValue={
                program?.amount_per_stamp_minor != null
                  ? formatMinorUnitsForInput(
                      program.amount_per_stamp_minor,
                      currencyCode,
                    )
                  : defaultAmountPerStamp
              }
              required
            />
          </label>
          <label className="check-field">
            <input
              name="carryRemainder"
              type="checkbox"
              defaultChecked={program?.carry_remainder ?? true}
            />
            <span>Acumular remanente entre compras</span>
          </label>

          </div>

          <div className="admin-form-section"><h2 className="section-title">Premios por sellos</h2>
          <RewardTiersEditor initialTiers={rewardTiers.map((tier) => ({
            id: tier.id,
            stampsRequired: tier.stamps_required,
            name: tier.name,
            description: tier.description,
            expirationDays: tier.expiration_days,
          }))} />
          </div>

          <div className="admin-form-section"><h2 className="section-title">Términos de la tarjeta</h2>
          <p className="field-hint">Este texto se mostrará junto con el catálogo de premios en la tarjeta digital del cliente.</p>
          <label className="field">
            <span>Términos y condiciones</span>
            <textarea
              name="termsAndConditions"
              minLength={10}
              maxLength={4000}
              defaultValue={program?.terms_and_conditions ?? "Los premios están sujetos a disponibilidad y deben canjearse en las sucursales participantes."}
              rows={6}
              required
            />
          </label>
          </div>

          <SubmitButton>
            {program ? "Guardar configuración" : "Crear programa"}
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}
