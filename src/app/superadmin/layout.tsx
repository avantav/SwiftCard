import type { ReactNode } from "react";
import { requireInternalArea } from "@/lib/auth/server";
import { SuperadminNavigation } from "@/components/superadmin-navigation";

export const dynamic = "force-dynamic";

export default async function SuperadminLayout({
  children
}: {
  children: ReactNode;
}) {
  const context = await requireInternalArea("SUPERADMIN");

  return (
    <div className="enterprise-app">
      <SuperadminNavigation email={context.email} />
      <div className="enterprise-main">{children}</div>
    </div>
  );
}
