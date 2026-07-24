import Link from "next/link";
import { requireInternalArea } from "@/lib/auth/server";
import { redeemReward } from "./actions";

type RedeemPageProps = { searchParams: Promise<{ error?: string; redeemed?: string }> };

export default async function RedeemPage({ searchParams }: RedeemPageProps) {
  const context = await requireInternalArea("APP");
  const params = await searchParams;
  const { data: rewards } = await context.supabase.from("rewards").select("id,name,description,customer_id").eq("status", "AVAILABLE").order("created_at");
  const { data: branches } = await context.supabase.from("branches").select("id,name").eq("status", "ACTIVE").order("name");
  return (
    <main className="shell auth-shell">
      <section className="auth-card" aria-labelledby="redeem-title">
        <Link className="text-link" href="/app">Volver</Link>
        <p className="eyebrow">PWA empleados</p>
        <h1 id="redeem-title" className="auth-title">Canjear recompensa</h1>
        {params.redeemed ? <p className="success-alert" role="status">Recompensa canjeada.</p> : null}
        {params.error ? <p className="auth-alert" role="alert">{params.error}</p> : null}
        <form className="auth-form" action={redeemReward}>
          <label className="field"><span>Recompensa</span><select name="rewardId" required defaultValue=""><option value="">Selecciona</option>{rewards?.map((reward) => <option key={reward.id} value={reward.id}>{reward.name} · Cliente {reward.customer_id.slice(0, 8)}</option>)}</select></label>
          <label className="field"><span>Sucursal</span><select name="branchId" required defaultValue=""><option value="">Selecciona</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <button className="primary-button" type="submit">Confirmar canje</button>
        </form>
      </section>
    </main>
  );
}
