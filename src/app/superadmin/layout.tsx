import type { ReactNode } from "react";
import { requireInternalArea } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function SuperadminLayout({
  children
}: {
  children: ReactNode;
}) {
  await requireInternalArea("SUPERADMIN");
  return children;
}
