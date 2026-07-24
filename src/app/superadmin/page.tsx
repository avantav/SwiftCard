import Link from "next/link";

type SuperadminPageProps = {
  searchParams: Promise<{
    tenantCreated?: string;
  }>;
};

export default async function SuperadminPage({
  searchParams
}: SuperadminPageProps) {
  const { tenantCreated } = await searchParams;

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Superadmin</p>
        <h1 className="title">Tenants y operación global.</h1>
        {tenantCreated ? (
          <p className="success-alert" role="status">
            Tenant creado.
          </p>
        ) : null}
        <p className="body-copy">
          Ruta reservada para crear tenants, suspenderlos, importar clientes y
          revisar auditoría global.
        </p>
        <div className="action-row">
          <Link className="primary-link" href="/superadmin/tenants/new">
            Nuevo tenant
          </Link>
        </div>
      </section>
    </main>
  );
}
