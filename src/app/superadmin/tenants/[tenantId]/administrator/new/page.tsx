import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveSuperadminContext } from "@/lib/auth/server";
import { createFirstAdministrator } from "./actions";

type NewAdministratorPageProps = {
  params: Promise<{
    tenantId: string;
  }>;
  searchParams: Promise<{
    administratorCreated?: string;
    error?: string;
    tenantCreated?: string;
  }>;
};

export default async function NewAdministratorPage({
  params,
  searchParams
}: NewAdministratorPageProps) {
  const { tenantId } = await params;
  const { administratorCreated, error, tenantCreated } = await searchParams;
  const superadmin = await getActiveSuperadminContext();

  if (!superadmin) {
    notFound();
  }

  const { data: tenant } = await superadmin.supabase
    .from("tenants")
    .select("id,name")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) {
    notFound();
  }

  const { data: existingAdministrator } = await superadmin.supabase
    .from("staff_profiles")
    .select("email,full_name,status")
    .eq("tenant_id", tenantId)
    .eq("role", "ADMIN")
    .limit(1)
    .maybeSingle();

  return (
    <main className="shell">
      <section className="panel form-panel" aria-labelledby="new-admin-title">
        <Link className="text-link" href="/superadmin">
          Volver
        </Link>
        <p className="eyebrow">Superadmin · {tenant.name}</p>
        <h1 id="new-admin-title" className="form-title">
          Primer Administrador
        </h1>
        {tenantCreated ? (
          <p className="success-alert" role="status">
            Tenant creado. Agrega su primer Administrador.
          </p>
        ) : null}
        {administratorCreated ? (
          <p className="success-alert" role="status">
            Administrador creado. Deberá cambiar la contraseña temporal al
            iniciar sesión.
          </p>
        ) : null}
        {error ? (
          <p className="auth-alert" role="alert">
            {error}
          </p>
        ) : null}
        {existingAdministrator ? (
          <dl className="summary-list">
            <div>
              <dt>Nombre</dt>
              <dd>{existingAdministrator.full_name}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{existingAdministrator.email}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{existingAdministrator.status}</dd>
            </div>
          </dl>
        ) : (
          <form
            className="form-grid"
            action={createFirstAdministrator.bind(null, tenantId)}
          >
            <label className="field form-span">
              <span>Nombre completo</span>
              <input name="fullName" autoComplete="name" required />
            </label>
            <label className="field form-span">
              <span>Correo</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label className="field">
              <span>Contraseña temporal</span>
              <input
                name="temporaryPassword"
                type="password"
                minLength={12}
                maxLength={72}
                autoComplete="new-password"
                required
              />
            </label>
            <label className="field">
              <span>Confirmar contraseña</span>
              <input
                name="passwordConfirmation"
                type="password"
                minLength={12}
                maxLength={72}
                autoComplete="new-password"
                required
              />
            </label>
            <button className="primary-button form-submit" type="submit">
              Crear Administrador
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
