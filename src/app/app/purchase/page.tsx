import { SubmitButton } from "@/components/submit-button";
import type { RegistrationScope } from "@/components/registration-scope-fields";
import { requireInternalArea } from "@/lib/auth/server";
import { confirmPurchase, previewPurchase } from "./actions";

type PurchasePageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function PurchasePage({ searchParams }: PurchasePageProps) {
  const context = await requireInternalArea("APP");
  const params = await searchParams;
  const customerCardId = params.customerCardId ?? "";
  const loyaltyCardId = params.loyaltyCardId ?? "";
  const hasPreview = params.previewStamps !== undefined;
  const { data: rawScopes, error: branchesError } = await context.supabase.schema("app").rpc("get_staff_registration_scopes");
  const cardScopes = ((rawScopes ?? []) as RegistrationScope[]).filter((scope) => scope.loyalty_card_id === loyaltyCardId);
  const cardName = cardScopes[0]?.card_name;

  return <main className="operations-page">
    <header className="operations-page-header"><p>Operación</p><h1>Registrar compra</h1><span>Previsualiza el cálculo antes de confirmar la operación.</span></header>
    {params.confirmed ? <p className="operations-alert is-success" role="status"><strong>Compra confirmada.</strong> Sellos: {params.stamps ?? "0"}. Recompensas: {params.rewards ?? "0"}.</p> : null}
    {params.error ? <p className="operations-alert is-error" role="alert">{params.error}</p> : null}
    {branchesError ? <p className="operations-alert is-error" role="alert">No se pudieron cargar las sucursales. Actualiza la página.</p> : null}
    {hasPreview ? <section className="operations-preview" aria-labelledby="purchase-preview-title"><div><span>Sellos</span><strong>{params.previewStamps}</strong></div><div><span>Balance proyectado</span><strong>{params.previewBalance}</strong></div><div><span>Remanente</span><strong>{params.previewRemainder}</strong></div><p id="purchase-preview-title">Previsualización calculada por SwiftWallet</p></section> : null}
    <section className="operations-card" aria-labelledby="purchase-data-title">
      <div className="operations-card-header"><h2 id="purchase-data-title">Datos de la compra</h2><p>El backend volverá a calcular los sellos al confirmar.</p></div>
      <form className="operations-form" action={previewPurchase}>
        <input name="customerCardId" type="hidden" value={customerCardId} />
        <input name="loyaltyCardId" type="hidden" value={loyaltyCardId} />
        <label className="field"><span>Tarjeta identificada</span><input value={cardName ?? "Vuelve a escanear la tarjeta"} readOnly aria-invalid={!cardName} /></label>
        <label className="field"><span>Sucursal participante</span><select name="branchId" defaultValue={params.branchId ?? ""} required disabled={!cardScopes.length}><option value="">Selecciona una sucursal</option>{cardScopes.map((scope) => <option key={scope.branch_id} value={scope.branch_id}>{scope.branch_name}</option>)}</select><small>Solo aparecen las ubicaciones asignadas a esta tarjeta y a tu cuenta.</small></label>
        <label className="field"><span>Monto en centavos</span><input name="amountMinor" type="number" inputMode="numeric" min="1" step="1" defaultValue={params.amountMinor ?? ""} required /></label>
        <SubmitButton disabled={!customerCardId || !cardScopes.length} className={hasPreview ? "operations-secondary-button" : "operations-primary-button"}>{hasPreview ? "Actualizar previsualización" : "Previsualizar compra"}</SubmitButton>
      </form>
    </section>
    {hasPreview ? <section className="operations-card operations-confirm-card" aria-labelledby="confirm-purchase-title"><div className="operations-card-header"><h2 id="confirm-purchase-title">Confirmar operación</h2><p>Verifica el ticket. La compra no se podrá editar después.</p></div><form className="operations-form" action={confirmPurchase}>
      <input type="hidden" name="customerCardId" value={customerCardId} /><input type="hidden" name="loyaltyCardId" value={loyaltyCardId} /><input type="hidden" name="branchId" value={params.branchId ?? ""} /><input type="hidden" name="amountMinor" value={params.amountMinor ?? ""} />
      <label className="field"><span>Número de ticket</span><input name="ticketNumber" required /></label>
      <SubmitButton className="operations-primary-button">Confirmar compra</SubmitButton>
    </form></section> : null}
  </main>;
}
