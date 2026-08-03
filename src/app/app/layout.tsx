import type { ReactNode } from "react";
import { OperationsNavigation } from "@/components/operations-navigation";
import { PwaController } from "@/components/pwa-controller";
import { requireInternalArea } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function EmployeeAppLayout({
  children
}: {
  children: ReactNode;
}) {
  const context = await requireInternalArea("APP");
  const role = context.access.role === "MANAGER" ? "MANAGER" : "EMPLOYEE";
  return <div className="operations-app"><OperationsNavigation email={context.email} role={role} /><div className="operations-main"><PwaController />{children}</div></div>;
}
