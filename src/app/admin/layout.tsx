import type { ReactNode } from "react";
import { AdminNavigation } from "@/components/admin-navigation";
import { requireInternalArea } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children
}: {
  children: ReactNode;
}) {
  const context = await requireInternalArea("ADMIN");
  const role = context.access.role === "ADMIN" ? "ADMIN" : "MANAGER";
  return <div className={`enterprise-app${context.supportSession ? " has-support-session" : ""}`}><AdminNavigation email={context.email} role={role} supportMode={Boolean(context.supportSession)} /><div className="enterprise-main">{context.supportSession ? <aside className="support-session-banner" role="status"><div><strong>Modo soporte · {context.supportSession.tenantName}</strong><span>Solo lectura · La sesión vence automáticamente en una hora.</span></div><form action="/support/exit" method="post"><button type="submit">Salir del modo soporte</button></form></aside> : null}{children}</div></div>;
}
