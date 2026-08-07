import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { unlockWithPin } from "./actions";

type UnlockPageProps = { searchParams: Promise<{ error?: string }> };

export default async function UnlockPage({ searchParams }: UnlockPageProps) {
  const context = await requireInternalArea("APP", { allowLockedShared: true });
  if (context.accountKind !== "BRANCH_SHARED" || context.pinOperator) {
    redirect("/app");
  }
  const { error } = await searchParams;

  return <main className="operations-page operations-unlock-page">
    <header className="operations-page-header"><p>Acceso de personal</p><h1>Ingresa tu PIN</h1><span>Usa tu PIN personal para que la actividad quede registrada a tu nombre.</span></header>
    {error ? <p className="operations-alert is-error" role="alert">{error}</p> : null}
    <section className="operations-card operations-unlock-card" aria-labelledby="pin-access-title">
      <div className="operations-card-header"><h2 id="pin-access-title">Identificación de turno</h2><p>La cuenta de la sucursal ya está conectada.</p></div>
      <form className="operations-form" action={unlockWithPin}>
        <label className="field"><span>PIN de seis dígitos</span><input name="pin" type="password" inputMode="numeric" autoComplete="off" minLength={6} maxLength={6} pattern="[0-9]{6}" required autoFocus /></label>
        <SubmitButton className="operations-primary-button">Entrar</SubmitButton>
      </form>
    </section>
  </main>;
}
