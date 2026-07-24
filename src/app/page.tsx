import Link from "next/link";

const routes = [
  {
    href: "/superadmin",
    label: "Superadmin",
    description: "Tenants, suspensión, importaciones y auditoría global."
  },
  {
    href: "/admin",
    label: "Administrador",
    description: "Sucursales, empleados, programa, clientes y reportes."
  },
  {
    href: "/app",
    label: "PWA empleados",
    description: "Escaneo, registro de clientes, compras y canjes."
  },
  {
    href: "/register/example-branch-token",
    label: "Registro público",
    description: "Autoservicio por token público de sucursal."
  },
  {
    href: "/card/example-card-token",
    label: "Web Card",
    description: "Tarjeta pública por token seguro."
  }
];

export default function HomePage() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">SwiftWallet MVP</p>
        <h1 className="title">Operación base para fidelidad digital multi-tenant.</h1>
        <p className="body-copy">
          Base inicial de rutas para construir el panel Superadmin, panel
          administrativo, PWA de empleados, registro público y Web Card según
          `docs/PRODUCT.md`.
        </p>
        <nav className="route-grid" aria-label="Rutas iniciales">
          {routes.map((route) => (
            <Link className="route-link" href={route.href} key={route.href}>
              <strong>{route.label}</strong>
              <span>{route.description}</span>
            </Link>
          ))}
        </nav>
      </section>
    </main>
  );
}

