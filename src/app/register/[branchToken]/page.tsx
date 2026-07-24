import { registerCustomer } from "./actions";

type RegisterPageProps = {
  params: Promise<{
    branchToken: string;
  }>;
  searchParams: Promise<{ created?: string; duplicate?: string; error?: string; cardToken?: string }>;
};

export default async function RegisterPage({ params, searchParams }: RegisterPageProps) {
  const { branchToken } = await params;
  const { created, duplicate, error, cardToken } = await searchParams;
  const action = registerCustomer.bind(null, branchToken);

  return (
    <main className="shell auth-shell">
      <section className="auth-card" aria-labelledby="registration-title">
        <p className="eyebrow">SwiftWallet</p>
        <h1 id="registration-title" className="auth-title">Crear tarjeta</h1>
        {created && cardToken ? <div className="auth-alert" role="status"><p>Tu tarjeta fue creada correctamente.</p><a className="primary-button" href={`/card/${encodeURIComponent(cardToken)}`}>Abrir mi tarjeta</a></div> : null}
        {duplicate ? <p className="auth-alert" role="alert">Este teléfono ya está registrado. Solicita ayuda a un empleado para recuperar tu tarjeta.</p> : null}
        {error ? <p className="auth-alert" role="alert">{error}</p> : null}
        {!created ? <form className="auth-form" action={action}>
          <label className="field"><span>Nombre completo</span><input name="fullName" required autoComplete="name" /></label>
          <label className="field"><span>Teléfono</span><input name="phone" required type="tel" autoComplete="tel" /></label>
          <label className="field"><span>Correo electrónico (opcional)</span><input name="email" type="email" autoComplete="email" /></label>
          <label className="field"><span>Fecha de nacimiento (opcional)</span><input name="birthDate" type="date" /></label>
          <label className="field"><span><input name="privacyConsent" type="checkbox" required /> Acepto el aviso de privacidad.</span></label>
          <button className="primary-button" type="submit">Crear tarjeta</button>
        </form> : null}
      </section>
    </main>
  );
}
