import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CardDesignEditor } from "@/components/card-design-editor";
import { CardProgramFields } from "@/components/card-program-fields";
import { RewardTiersEditor } from "@/components/reward-tiers-editor";
import { SubmitButton } from "@/components/submit-button";
import { formatMinorUnitsForInput } from "@/lib/admin/program";
import { requireInternalArea } from "@/lib/auth/server";
import { publishCard, saveCardDesign, saveCardLocations, saveCardProgram } from "../../actions";

type EditPageProps = {
  params: Promise<{ cardId: string }>;
  searchParams: Promise<{ step?: string; error?: string; saved?: string; created?: string }>;
};
type CardRow = {
  id: string; name: string; status: "DRAFT" | "PUBLISHED"; program_id: string;
  program_completed: boolean; design_completed: boolean; locations_completed: boolean; current_step: number;
  wallet_enabled: boolean; logo_text: string; description: string; background_color: string;
  foreground_color: string; label_color: string; logo_image_url: string | null; strip_image_url: string | null;
};

const steps = ["Programa", "Diseño", "Sucursales", "Publicar"];

export default async function EditCardPage({ params, searchParams }: EditPageProps) {
  const context = await requireInternalArea("ADMIN");
  if (context.access.role !== "ADMIN" || !context.tenantId) redirect("/admin");
  const [{ cardId }, query] = await Promise.all([params, searchParams]);
  const [{ data: rawCard, error: cardError }, { data: tenant }, { data: branches }] = await Promise.all([
    context.supabase.from("loyalty_cards").select("id,name,status,program_id,program_completed,design_completed,locations_completed,current_step,wallet_enabled,logo_text,description,background_color,foreground_color,label_color,logo_image_url,strip_image_url").eq("id", cardId).eq("tenant_id", context.tenantId).maybeSingle(),
    context.supabase.from("tenants").select("name,currency_code,logo_url,banner_url").eq("id", context.tenantId).maybeSingle(),
    context.supabase.from("branches").select("id,name,address,status").eq("tenant_id", context.tenantId).eq("status", "ACTIVE").order("name"),
  ]);
  if (cardError || !rawCard) notFound();
  const card = rawCard as CardRow;
  const requestedStep = Math.min(4, Math.max(1, Number(query.step) || card.current_step));
  const maxStep = card.status === "PUBLISHED" ? 4 : card.locations_completed ? 4 : card.design_completed ? 3 : card.program_completed ? 2 : 1;
  if (requestedStep > maxStep) redirect(`/admin/cards/${cardId}/edit?step=${maxStep}`);
  const [{ data: rawProgram }, { data: rawTiers }, { data: assignments }] = await Promise.all([
    context.supabase.from("loyalty_programs").select("id,name,program_type,rule_type,minimum_purchase_minor,stamps_per_purchase,amount_per_stamp_minor,carry_remainder,terms_and_conditions,unit_name_singular,unit_name_plural").eq("id", card.program_id).maybeSingle(),
    context.supabase.from("loyalty_reward_tiers").select("id,stamps_required,name,description,expiration_days").eq("program_id", card.program_id).eq("active", true).order("stamps_required"),
    context.supabase.from("loyalty_card_branches").select("branch_id").eq("loyalty_card_id", card.id),
  ]);
  const program = rawProgram as null | {
    name: string; program_type: "STAMPS_PER_PURCHASE" | "STAMPS_PER_AMOUNT" | "LIFETIME_POINTS"; minimum_purchase_minor: number | string;
    stamps_per_purchase: number; amount_per_stamp_minor: number | string | null; carry_remainder: boolean; terms_and_conditions: string;
    unit_name_singular: string; unit_name_plural: string;
  };
  if (!program) notFound();
  const currency = tenant?.currency_code ?? "MXN";
  const rewardGoal = (rawTiers ?? []).reduce(
    (maximum, tier) => Math.max(maximum, Number(tier.stamps_required)),
    0,
  ) || null;
  const assigned = new Set((assignments ?? []).map((row) => row.branch_id));
  const saveProgram = saveCardProgram.bind(null, card.id);
  const saveDesign = saveCardDesign.bind(null, card.id);
  const saveLocations = saveCardLocations.bind(null, card.id);
  const doPublish = publishCard.bind(null, card.id);

  return <main className="enterprise-page card-wizard-page">
    <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb"><Link href="/admin/cards">Tarjetas</Link> · {card.status === "DRAFT" ? "Borrador" : "Publicada"}</p><h1 id="card-wizard-title">{card.name}</h1><p>Configura una sola tarjeta para Apple y Android. Cada etapa se guarda por separado.</p></div><Link className="secondary-button" href="/admin/cards">Salir al listado</Link></header>
    <nav className="card-wizard-steps" aria-label="Etapas de configuración"><ol>{steps.map((label, index) => {
      const number = index + 1; const available = number <= maxStep;
      const complete = [card.program_completed, card.design_completed, card.locations_completed, card.status === "PUBLISHED"][index];
      return <li className={`${requestedStep === number ? "is-current" : ""}${complete ? " is-complete" : ""}`} key={label}>{available ? <Link aria-current={requestedStep === number ? "step" : undefined} href={`/admin/cards/${card.id}/edit?step=${number}`}><span>{complete ? "✓" : number}</span>{label}</Link> : <span><span>{number}</span>{label}</span>}</li>;
    })}</ol></nav>
    {query.created ? <p className="enterprise-alert is-info" role="status">Borrador creado. Puedes salir y retomarlo desde Tarjetas.</p> : null}
    {query.saved ? <p className="enterprise-alert is-success" role="status">Etapa guardada en el borrador.</p> : null}
    {query.error ? <p className="enterprise-alert is-error" role="alert">{query.error}</p> : null}

    {requestedStep === 1 ? <section className="enterprise-content-card card-wizard-stage" aria-labelledby="program-step-title"><div className="card-stage-heading"><p>Etapa 1 de 4</p><h2 id="program-step-title">Programa de recompensas</h2><span>Define cómo se llena esta tarjeta y qué obtiene el cliente.</span></div><form action={saveProgram} className="auth-form">
      <input name="status" type="hidden" value="PAUSED" />
      <label className="field"><span>Nombre de la tarjeta y programa</span><input defaultValue={program.name} maxLength={80} name="name" required /></label>
      <CardProgramFields
        amountPerStamp={formatMinorUnitsForInput(program.amount_per_stamp_minor ?? 100, currency)}
        initialType={program.program_type === "STAMPS_PER_AMOUNT" ? "STAMPS_PER_AMOUNT" : "STAMPS_PER_PURCHASE"}
        minimumPurchase={formatMinorUnitsForInput(program.minimum_purchase_minor, currency)}
        stampsPerPurchase={program.stamps_per_purchase}
      />
      <div className="form-grid"><label className="field"><span>Unidad singular</span><input defaultValue={program.unit_name_singular} maxLength={24} name="unitNameSingular" required /></label><label className="field"><span>Unidad plural</span><input defaultValue={program.unit_name_plural} maxLength={24} name="unitNamePlural" required /></label></div>
      <RewardTiersEditor initialTiers={(rawTiers ?? []).map((tier) => ({ id: tier.id, stampsRequired: tier.stamps_required, name: tier.name, description: tier.description, expirationDays: tier.expiration_days }))} />
      <label className="field"><span>Términos y condiciones</span><textarea defaultValue={program.terms_and_conditions} maxLength={4000} minLength={10} name="termsAndConditions" rows={5} required /></label>
      <div className="card-stage-actions"><SubmitButton className="secondary-button" name="intent" value="exit">Guardar y salir</SubmitButton><SubmitButton>Guardar y continuar</SubmitButton></div>
    </form></section> : null}

    {requestedStep === 2 ? <section className="enterprise-content-card card-wizard-stage" aria-labelledby="design-step-title"><div className="card-stage-heading"><p>Etapa 2 de 4</p><h2 id="design-step-title">Diseño de la tarjeta</h2><span>Configura una identidad única y comprueba cómo se adapta en ambos dispositivos.</span></div><form action={saveDesign} className="auth-form"><CardDesignEditor initial={{ appleEnabled: card.wallet_enabled, logoText: card.logo_text, description: card.description, backgroundColor: card.background_color, foregroundColor: card.foreground_color, labelColor: card.label_color, logoImageUrl: card.logo_image_url ?? "", stripImageUrl: card.strip_image_url ?? "" }} preview={{ tenantName: tenant?.name ?? "Tu negocio", programName: program.name, rewardGoal, unitNameSingular: program.unit_name_singular, unitNamePlural: program.unit_name_plural, fallbackLogoImageUrl: tenant?.logo_url ?? "", fallbackStripImageUrl: tenant?.banner_url ?? "" }} tenantId={context.tenantId} /><div className="card-stage-actions"><Link className="secondary-button" href={`/admin/cards/${card.id}/edit?step=1`}>Anterior</Link><div className="card-stage-save-actions"><SubmitButton className="secondary-button" name="intent" value="exit">Guardar y salir</SubmitButton><SubmitButton>Guardar y continuar</SubmitButton></div></div></form></section> : null}

    {requestedStep === 3 ? <section className="enterprise-content-card card-wizard-stage" aria-labelledby="locations-step-title"><div className="card-stage-heading"><p>Etapa 3 de 4</p><h2 id="locations-step-title">Sucursales participantes</h2><span>Elige una o varias. La tarjeta solo podrá registrarse y usarse en estas ubicaciones.</span></div><form action={saveLocations} className="auth-form"><fieldset className="card-location-list"><legend>Ubicaciones disponibles</legend>{branches?.length ? branches.map((branch) => <label className="card-location-option" key={branch.id}><input defaultChecked={assigned.has(branch.id)} name="branchId" type="checkbox" value={branch.id} /><span><strong>{branch.name}</strong><small>{branch.address || "Dirección no registrada"}</small></span></label>) : <p className="enterprise-alert is-warning">Crea una sucursal activa antes de publicar esta tarjeta.</p>}</fieldset><div className="card-stage-actions"><Link className="secondary-button" href={`/admin/cards/${card.id}/edit?step=2`}>Anterior</Link><div className="card-stage-save-actions"><SubmitButton className="secondary-button" disabled={!branches?.length} name="intent" value="exit">Guardar y salir</SubmitButton><SubmitButton disabled={!branches?.length}>Guardar y continuar</SubmitButton></div></div></form></section> : null}

    {requestedStep === 4 ? <section className="enterprise-content-card card-wizard-stage" aria-labelledby="publish-step-title"><div className="card-stage-heading"><p>Etapa 4 de 4</p><h2 id="publish-step-title">Revisar y publicar</h2><span>Al publicar, el programa se activa únicamente en las sucursales elegidas.</span></div><dl className="card-review-grid"><div><dt>Tarjeta</dt><dd>{card.name}</dd></div><div><dt>Programa</dt><dd>{program.program_type === "STAMPS_PER_AMOUNT" ? "Sellos por monto" : "Sellos por compra"}</dd></div><div><dt>Recompensas</dt><dd>{rawTiers?.length ?? 0} niveles</dd></div><div><dt>Sucursales</dt><dd>{assigned.size} seleccionadas</dd></div><div><dt>Wallets</dt><dd>Diseño unificado Apple / Android</dd></div><div><dt>Estado</dt><dd>{card.status === "PUBLISHED" ? "Publicada" : "Lista para publicar"}</dd></div></dl><div className="card-stage-actions"><Link className="secondary-button" href={`/admin/cards/${card.id}/edit?step=3`}>Anterior</Link>{card.status === "DRAFT" ? <form action={doPublish}><SubmitButton>Publicar tarjeta</SubmitButton></form> : <Link className="primary-button" href="/admin/cards">Volver a tarjetas</Link>}</div></section> : null}
  </main>;
}
