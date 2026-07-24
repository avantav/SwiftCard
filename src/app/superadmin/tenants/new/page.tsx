import Link from "next/link";
import { createTenant } from "./actions";

type NewTenantPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewTenantPage({
  searchParams
}: NewTenantPageProps) {
  const { error } = await searchParams;

  return (
    <main className="shell">
      <section className="panel form-panel" aria-labelledby="new-tenant-title">
        <Link className="text-link" href="/superadmin">
          Volver
        </Link>
        <p className="eyebrow">Superadmin</p>
        <h1 id="new-tenant-title" className="form-title">
          Nuevo tenant
        </h1>
        {error ? (
          <p className="auth-alert" role="alert">
            {error}
          </p>
        ) : null}
        <form className="form-grid" action={createTenant}>
          <label className="field">
            <span>Nombre</span>
            <input name="name" required />
          </label>
          <label className="field">
            <span>Contacto</span>
            <input name="contactName" />
          </label>
          <label className="field">
            <span>Correo</span>
            <input name="contactEmail" type="email" />
          </label>
          <label className="field">
            <span>Teléfono</span>
            <input name="contactPhone" />
          </label>
          <label className="field">
            <span>Moneda</span>
            <input name="currencyCode" defaultValue="MXN" maxLength={3} required />
          </label>
          <label className="field">
            <span>Zona horaria</span>
            <input name="timezone" defaultValue="America/Mazatlan" required />
          </label>
          <label className="field">
            <span>Branding</span>
            <select name="brandingMode" defaultValue="STANDARD">
              <option value="STANDARD">Standard</option>
              <option value="WHITE_LABEL">White-label</option>
            </select>
          </label>
          <label className="field">
            <span>Estado</span>
            <select name="status" defaultValue="ACTIVE">
              <option value="ACTIVE">Activo</option>
              <option value="SUSPENDED">Suspendido</option>
            </select>
          </label>
          <label className="field">
            <span>Color principal</span>
            <input name="primaryColor" type="color" defaultValue="#149C91" />
          </label>
          <label className="field">
            <span>Color secundario</span>
            <input name="secondaryColor" type="color" defaultValue="#17202A" />
          </label>
          <button className="primary-button form-submit" type="submit">
            Crear tenant
          </button>
        </form>
      </section>
    </main>
  );
}

