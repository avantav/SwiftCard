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
  return <div className="enterprise-app"><AdminNavigation email={context.email} role={role} /><div className="enterprise-main">{children}</div></div>;
}
