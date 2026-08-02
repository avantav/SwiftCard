"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { signOut } from "@/app/logout/actions";
import { EnterpriseIcon, type EnterpriseIconName } from "@/components/enterprise-navigation";

const items: Array<{ href: string; label: string; icon: EnterpriseIconName; exact?: boolean }> = [
  { href: "/app", label: "Registro", icon: "user-plus", exact: true },
  { href: "/app/scan", label: "Escanear", icon: "scan" },
  { href: "/app/customers", label: "Clientes", icon: "search" },
  { href: "/app/purchase", label: "Compra", icon: "cart" },
  { href: "/app/redeem", label: "Canje", icon: "award" }
];

function OperationsLogout() {
  const { pending } = useFormStatus();
  return <button className="operations-logout" disabled={pending} type="submit"><EnterpriseIcon name="logout" /><span>{pending ? "Saliendo…" : "Salir"}</span></button>;
}

export function OperationsNavigation({ email, role }: { email: string | null; role: "MANAGER" | "EMPLOYEE" }) {
  const pathname = usePathname();
  return <>
    <header className="operations-header">
      <Link className="operations-brand" href="/app"><span className="enterprise-brand-mark" aria-hidden="true"><span /></span><span><strong>SwiftWallet</strong><small>{role === "MANAGER" ? "Encargado" : "Empleado"} · {email ?? "Operación"}</small></span></Link>
      <form action={signOut}><OperationsLogout /></form>
    </header>
    <nav aria-label="Navegación operativa" className="operations-bottom-nav">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <Link aria-current={active ? "page" : undefined} className={active ? "is-active" : ""} href={item.href} key={item.href}><EnterpriseIcon name={item.icon} /><span>{item.label}</span></Link>;
      })}
    </nav>
  </>;
}
