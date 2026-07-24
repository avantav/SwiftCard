import Link from "next/link";
import { requireInternalArea } from "@/lib/auth/server";
import { confirmPurchase, previewPurchase } from "./actions";
import { SubmitButton } from "@/components/submit-button";

type PurchasePageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function PurchasePage({ searchParams }: PurchasePageProps) {
  const context = await requireInternalArea("APP");
  const params = await searchParams;
  const customerId = params.customerId ?? "";
  const hasPreview = params.previewStamps !== undefined;
  const { data: branches } = await context.supabase.from("branches").select("id,name").eq("status", "ACTIVE").order("name");

  return (
    <main className="shell auth-shell">
      <section className="auth-card" aria-labelledby="purchase-title">
        <Link className="text-link" href="/app">Volver</Link>
        <p className="eyebrow">PWA empleados</p>
        <h1 id="purchase-title" className="auth-title">Registrar compra</h1>
        {params.confirmed ? <p className="success-alert" role="status">Compra confirmada. Sellos otorgados: {params.stamps ?? "0"}. Recompensas generadas: {params.rewards ?? "0"}.</p> : null}
        {params.error ? <p className="auth-alert" role="alert">{params.error}</p> : null}
        {hasPreview ? <p className="success-alert" role="status">Previsualización: {params.previewStamps} sellos. Balance proyectado: {params.previewBalance}. Remanente: {params.previewRemainder}.</p> : null}
        <form className="auth-form" action={previewPurchase}>
          <label className="field"><span>Cliente</span><input name="customerId" value={customerId} readOnly required /></label>
          <label className="field"><span>Sucursal</span><select name="branchId" defaultValue={params.branchId ?? ""} required><option value="">Selecciona</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label className="field"><span>Monto en centavos</span><input name="amountMinor" type="number" min="1" step="1" defaultValue={params.amountMinor ?? ""} required /></label>
          <SubmitButton>Previsualizar compra</SubmitButton>
        </form>
        {hasPreview ? <form className="auth-form purchase-confirm-form" action={confirmPurchase}>
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="branchId" value={params.branchId ?? ""} />
          <input type="hidden" name="amountMinor" value={params.amountMinor ?? ""} />
          <label className="field"><span>Número de ticket</span><input name="ticketNumber" required /></label>
          <SubmitButton className="secondary-button">Confirmar compra</SubmitButton>
        </form> : null}
      </section>
    </main>
  );
}
