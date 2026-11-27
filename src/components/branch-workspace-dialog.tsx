"use client";

import type { ReactNode } from "react";
import { WorkspaceDialog } from "@/components/admin/workspace-dialog";

/**
 * Kept for existing callers (branches, staff, cards); the behavior lives in
 * the shared WorkspaceDialog (DEC-0073).
 */
export function BranchWorkspaceDialog({ children, closeHref = "/admin/branches", labelledBy }: {
  children: ReactNode;
  closeHref?: string;
  labelledBy: string;
}) {
  return <WorkspaceDialog closeHref={closeHref} labelledBy={labelledBy} size="lg">{children}</WorkspaceDialog>;
}
