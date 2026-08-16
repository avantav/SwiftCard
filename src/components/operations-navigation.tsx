"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { signOut } from "@/app/logout/actions";
import { changePinOperator } from "@/app/app/unlock/actions";
import { EnterpriseIcon, type EnterpriseIconName } from "@/components/enterprise-navigation";

const items: Array<{ href: string; label: string; icon: EnterpriseIconName; exact?: boolean; matches?: string[] }> = [
  { href: "/app", label: "Registro", icon: "user-plus", exact: true },
  { href: "/app/scan", label: "Clientes", icon: "scan", matches: ["/app/scan", "/app/purchase", "/app/redeem"] },
  { href: "/app/program", label: "Programa", icon: "award" }
];

function OperationsLogout() {
  const { pending } = useFormStatus();
  return <button className="operations-logout" disabled={pending} type="submit"><EnterpriseIcon name="logout" /><span>{pending ? "Saliendo…" : "Salir"}</span></button>;
}

export function OperationsNavigation({ accountKind, operatorName, tenantLogoUrl, tenantName }: { accountKind: "INDIVIDUAL" | "BRANCH_SHARED"; operatorName: string | null; tenantLogoUrl: string | null; tenantName: string }) {
  const pathname = usePathname();
  const isUnlock = pathname === "/app/unlock";
  const tenantInitials = tenantName.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  return <>
    <header className="operations-header">
      <Link aria-label={`${tenantName} · Inicio`} className="operations-brand" href={isUnlock ? "/app/unlock" : "/app"}>
        <span className="operations-tenant-mark">{tenantLogoUrl ? <Image alt="" height={34} src={tenantLogoUrl} unoptimized width={34} /> : <span aria-hidden="true">{tenantInitials || "SW"}</span>}</span>
        <span><strong>{tenantName}</strong>{operatorName ? <small>{operatorName}</small> : null}</span>
      </Link>
      <div className="operations-session-actions">
        {accountKind === "BRANCH_SHARED" && operatorName ? <form action={changePinOperator}><button className="operations-logout" type="submit"><EnterpriseIcon name="users" /><span>Cambiar usuario</span></button></form> : null}
        <form action={signOut}><OperationsLogout /></form>
      </div>
    </header>
    {!isUnlock ? <nav aria-label="Navegación operativa" className="operations-bottom-nav">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : (item.matches ?? [item.href]).some((match) => pathname === match || pathname.startsWith(`${match}/`));
        return <Link aria-current={active ? "page" : undefined} className={active ? "is-active" : ""} href={item.href} key={item.href}><EnterpriseIcon name={item.icon} /><span>{item.label}</span></Link>;
      })}
    </nav> : null}
  </>;
}
