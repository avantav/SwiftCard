"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { signOut } from "@/app/logout/actions";

type IconName = "building" | "close" | "import" | "logout" | "menu";

const navigation = [
  { href: "/superadmin", label: "Tenants", icon: "building" as const },
  { href: "/superadmin/imports", label: "Importaciones", icon: "import" as const }
];

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    building: (
      <>
        <path d="M4 20h16" />
        <path d="M6 20V8l6-4 6 4v12" />
        <path d="M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    import: (
      <>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />
  };

  return (
    <svg aria-hidden="true" className="enterprise-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function LogoutButton() {
  const { pending } = useFormStatus();

  return (
    <button className="enterprise-user-action" type="submit" disabled={pending}>
      <Icon name="logout" />
      <span>{pending ? "Cerrando sesión…" : "Cerrar sesión"}</span>
    </button>
  );
}

function isCurrentRoute(pathname: string, href: string) {
  if (href === "/superadmin") {
    return pathname === href || pathname.startsWith("/superadmin/tenants");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SuperadminNavigation({ email }: { email: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="enterprise-mobile-header">
        <Link className="enterprise-mobile-brand" href="/superadmin">
          <span className="enterprise-brand-mark" aria-hidden="true"><span /></span>
          <span>SwiftWallet</span>
        </Link>
        <button
          aria-controls="superadmin-navigation"
          aria-expanded={open}
          aria-label={open ? "Cerrar navegación" : "Abrir navegación"}
          className="enterprise-mobile-menu"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
      </header>

      {open ? <button aria-label="Cerrar navegación" className="enterprise-nav-backdrop" onClick={() => setOpen(false)} type="button" /> : null}

      <aside className={`enterprise-sidebar${open ? " is-open" : ""}`} id="superadmin-navigation">
        <Link className="enterprise-brand" href="/superadmin" onClick={() => setOpen(false)}>
          <span className="enterprise-brand-mark" aria-hidden="true"><span /></span>
          <span className="enterprise-brand-copy"><strong>SwiftWallet</strong><small>Control center</small></span>
        </Link>

        <nav aria-label="Navegación Superadmin" className="enterprise-nav">
          <p className="enterprise-nav-label">Operación</p>
          {navigation.map((item) => {
            const active = isCurrentRoute(pathname, item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`enterprise-nav-link${active ? " is-active" : ""}`}
                href={item.href}
                key={item.href}
                onClick={() => setOpen(false)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="enterprise-sidebar-footer">
          <div className="enterprise-user">
            <span className="enterprise-user-avatar" aria-hidden="true">SA</span>
            <span className="enterprise-user-copy">
              <strong>Superadmin</strong>
              <small>{email ?? "Cuenta global"}</small>
            </span>
          </div>
          <form action={signOut}>
            <LogoutButton />
          </form>
        </div>
      </aside>
    </>
  );
}
