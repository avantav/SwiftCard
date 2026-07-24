import type { ReactNode } from "react";
import { requireInternalArea } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children
}: {
  children: ReactNode;
}) {
  await requireInternalArea("ADMIN");
  return children;
}
