import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { RewardTiersEditor } from "@/components/reward-tiers-editor";
import { ProgramTypeControls } from "@/components/program-type-controls";
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
  program_type: "STAMPS_PER_PURCHASE" | "STAMPS_PER_AMOUNT" | "LIFETIME_POINTS";
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
  unit_name_singular: string;
  unit_name_plural: string;
  welcome_reward_enabled: boolean;
  welcome_reward_name: string | null;
  welcome_reward_description: string | null;
  welcome_reward_expiration_days: number | null;
  grant_welcome_reward_to_imports: boolean;
  import_stamp_to_point_multiplier: number;
  allow_purchase_cancellations: boolean;
  allow_reward_cancellations: boolean;
  allow_redemption_reversals: boolean;
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
          "id,name,status,program_type,rule_type,minimum_purchase_minor,stamps_per_purchase,amount_per_stamp_minor,carry_remainder,reward_stamp_goal,reward_name,reward_description,reward_expiration_days,terms_and_conditions,unit_name_singular,unit_name_plural,welcome_reward_enabled,welcome_reward_name,welcome_reward_description,welcome_reward_expiration_days,grant_welcome_reward_to_imports,import_stamp_to_point_multiplier,allow_purchase_cancellations,allow_reward_cancellations,allow_redemption_reversals,version",
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
          <input name="configurationOptionsPresent" type="hidden" value="1" />
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

          <ProgramTypeControls
            hasExistingProgram={Boolean(program)}
            initialStatus={program?.status ?? "ACTIVE"}
            initialType={program?.program_type ?? "STAMPS_PER_PURCHASE"}
          />

          <p className="enterprise-alert is-info" role="status">
            El Admin general puede cambiar el tipo. El cambio se confirma antes de guardar, conserva el historial y aplica la nueva regla a compras futuras.
          </p>

          <div className="admin-form-section"><h2 className="section-title">Terminología</h2>
          <p className="field-hint">Define cómo se llamará la unidad en las pantallas del programa.</p>
          <div className="form-grid">
            <label className="field">
              <span>Nombre singular</span>
              <input name="unitNameSingular" maxLength={24} defaultValue={program?.unit_name_singular ?? "sello"} required />
            </label>
            <label className="field">
              <span>Nombre plural</span>
              <input name="unitNamePlural" maxLength={24} defaultValue={program?.unit_name_plural ?? "sellos"} required />
            </label>
          </div>
          </div>

          <div className="admin-form-section program-type-purchase"><h2 className="section-title">Regla por compra</h2>
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
              />
            </label>
          </div>

          </div>

          <div className="admin-form-section program-type-lifetime"><h2 className="section-title">Puntos acumulativos</h2>
          <p className="field-hint">
            Aplica al tercer tipo. Los puntos no reinician, cada hito se entrega una sola vez y las compras futuras usan el monto configurado.
          </p>
          <p className="enterprise-alert is-warning" role="status">Esta primera entrega guarda la configuración en pausa. La activación se habilitará junto con el cálculo decimal y la generación de hitos.</p>
          <div className="form-grid">
            <label className="field">
              <span>Monto entero por punto ({currencyCode})</span>
              <input
                name="pointsAmount"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                defaultValue={program?.program_type === "LIFETIME_POINTS" && program.amount_per_stamp_minor != null
                  ? String(Number(formatMinorUnitsForInput(program.amount_per_stamp_minor, currencyCode)))
                  : "10"}
              />
            </label>
            <label className="field">
              <span>Puntos por cada sello importado</span>
              <input
                name="importStampToPointMultiplier"
                type="number"
                min={1}
                max={1_000_000}
                step={1}
                defaultValue={program?.import_stamp_to_point_multiplier ?? 1}
                required
              />
            </label>
          </div>
          <p className="field-hint">El cálculo operativo usará un decimal y truncará cada compra. Clientes y empleados verán enteros; administradores y exportaciones verán un decimal.</p>
          </div>

          <div className="admin-form-section program-type-lifetime"><h2 className="section-title">Recompensa de bienvenida</h2>
          <label className="check-field">
            <input name="welcomeRewardEnabled" type="checkbox" defaultChecked={program?.welcome_reward_enabled ?? false} />
            <span>Otorgar una recompensa una sola vez al registrarse</span>
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Nombre de la recompensa</span>
              <input name="welcomeRewardName" maxLength={120} defaultValue={program?.welcome_reward_name ?? "Recompensa de bienvenida"} />
            </label>
            <label className="field">
              <span>Vigencia en días</span>
              <input name="welcomeRewardExpirationDays" type="number" min={1} max={3650} defaultValue={program?.welcome_reward_expiration_days ?? ""} placeholder="Sin expiración" />
            </label>
          </div>
          <label className="field">
            <span>Descripción</span>
            <textarea name="welcomeRewardDescription" maxLength={500} defaultValue={program?.welcome_reward_description ?? "Describe el beneficio que recibe el cliente al registrarse."} rows={3} />
          </label>
          <label className="check-field">
            <input name="grantWelcomeRewardToImports" type="checkbox" defaultChecked={program?.grant_welcome_reward_to_imports ?? false} />
            <span>Entregar también la bienvenida a clientes importados</span>
          </label>
          </div>

          <div className="admin-form-section program-type-amount"><h2 className="section-title">Regla por monto</h2>
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

          <div className="admin-form-section"><h2 className="section-title">Hitos y recompensas</h2>
          <RewardTiersEditor initialTiers={rewardTiers.map((tier) => ({
            id: tier.id,
            stampsRequired: tier.stamps_required,
            name: tier.name,
            description: tier.description,
            expirationDays: tier.expiration_days,
          }))} />
          </div>

          <div className="admin-form-section"><h2 className="section-title">Políticas operativas</h2>
          <p className="field-hint">Estas opciones permiten adaptar el control administrativo sin cambiar el historial.</p>
          <div className="program-policy-list">
            <label className="check-field">
              <input name="allowPurchaseCancellations" type="checkbox" defaultChecked={program?.allow_purchase_cancellations ?? true} />
              <span>Permitir cancelaciones de compras</span>
            </label>
            <label className="check-field">
              <input name="allowRewardCancellations" type="checkbox" defaultChecked={program?.allow_reward_cancellations ?? true} />
              <span>Permitir cancelaciones manuales de recompensas</span>
            </label>
            <label className="check-field">
              <input name="allowRedemptionReversals" type="checkbox" defaultChecked={program?.allow_redemption_reversals ?? true} />
              <span>Permitir que Administradores reviertan canjes</span>
            </label>
          </div>
          <p className="field-hint">Los ajustes manuales de puntos permanecen deshabilitados para el nuevo sistema acumulativo.</p>
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
