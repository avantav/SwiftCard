import type { ReactNode } from "react";
import { requireInternalArea } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function EmployeeAppLayout({
  children
}: {
  children: ReactNode;
}) {
  await requireInternalArea("APP");
  return children;
}
