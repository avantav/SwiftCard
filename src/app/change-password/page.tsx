import { requirePasswordChangeContext } from "@/lib/auth/server";
import { changeRequiredPassword } from "./actions";

export const dynamic = "force-dynamic";

type ChangePasswordPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ChangePasswordPage({
  searchParams
}: ChangePasswordPageProps) {
  await requirePasswordChangeContext();
  const { error } = await searchParams;

  return (
    <main className="shell auth-shell">
      <section className="auth-card" aria-labelledby="change-password-title">
        <p className="eyebrow">Seguridad</p>
        <h1 id="change-password-title" className="auth-title">
          Cambiar contraseña
        </h1>
        {error ? (
          <p className="auth-alert" role="alert">
            {error}
          </p>
        ) : null}
        <form className="auth-form" action={changeRequiredPassword}>
          <label className="field">
            <span>Contraseña temporal</span>
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label className="field">
            <span>Nueva contraseña</span>
            <input
              name="newPassword"
              type="password"
              minLength={12}
              maxLength={72}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="field">
            <span>Confirmar nueva contraseña</span>
            <input
              name="passwordConfirmation"
              type="password"
              minLength={12}
              maxLength={72}
              autoComplete="new-password"
              required
            />
          </label>
          <button className="primary-button" type="submit">
            Guardar contraseña
          </button>
        </form>
      </section>
    </main>
  );
}
