import type { ReactNode } from "react";
import type { Viewport } from "next";
import { OperationsNavigation } from "@/components/operations-navigation";
import { PwaController } from "@/components/pwa-controller";
import { requireInternalArea } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#149c91",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover"
};

export default async function EmployeeAppLayout({
  children
}: {
  children: ReactNode;
}) {
  const context = await requireInternalArea("APP", { allowLockedShared: true });
  const role = context.access.role === "MANAGER" ? "MANAGER" : "EMPLOYEE";
  return <div className="operations-app"><OperationsNavigation accountKind={context.accountKind} email={context.email} operatorName={context.pinOperator?.fullName ?? null} role={role} /><div className="operations-main"><PwaController />{children}</div></div>;
}
