import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { redeemReward } from "./actions";

type RedeemPageProps = { searchParams: Promise<{ error?: string; redeemed?: string }> };

export default async function RedeemPage({ searchParams }: RedeemPageProps) {
  const context = await requireInternalArea("APP");
  const params = await searchParams;
  await context.supabase.schema("app").rpc("expire_due_rewards");
  const now = new Date().toISOString();
  const [{ data: rewards, error: rewardsError }, { data: branches, error: branchesError }] = await Promise.all([
    context.supabase.from("rewards").select("id,name,description,customer_id").eq("status", "AVAILABLE").or(`expires_at.is.null,expires_at.gt.${now}`).order("created_at"),
    context.supabase.from("branches").select("id,name").eq("status", "ACTIVE").order("name")
  ]);

  return <main className="operations-page">
    <header className="operations-page-header"><p>Recompensas</p><h1>Canjear recompensa</h1><span>Cada confirmación utiliza una sola recompensa disponible.</span></header>
    {params.redeemed ? <p className="operations-alert is-success" role="status">Recompensa canjeada correctamente.</p> : null}
    {params.error ? <p className="operations-alert is-error" role="alert">{params.error}</p> : null}
    {rewardsError || branchesError ? <p className="operations-alert is-error" role="alert">No se pudo cargar la información de canje. Actualiza la página.</p> : null}
    {rewardsError || branchesError ? null : !rewards?.length ? <div className="operations-empty-state"><h2>No hay recompensas disponibles</h2><p>Escanea o busca otro cliente para revisar su saldo.</p></div> : <section className="operations-card operations-confirm-card" aria-labelledby="redeem-form-title">
      <div className="operations-card-header"><h2 id="redeem-form-title">Confirmación de canje</h2><p>Verifica la recompensa y sucursal antes de continuar.</p></div>
      <form className="operations-form" action={redeemReward}>
        <label className="field"><span>Recompensa</span><select name="rewardId" required defaultValue=""><option value="">Selecciona una recompensa</option>{rewards.map((reward) => <option key={reward.id} value={reward.id}>{reward.name} · Cliente {reward.customer_id.slice(0, 8)}</option>)}</select></label>
        <label className="field"><span>Sucursal</span><select name="branchId" required defaultValue=""><option value="">Selecciona una sucursal</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <SubmitButton className="operations-primary-button">Confirmar canje</SubmitButton>
      </form>
    </section>}
  </main>;
}
