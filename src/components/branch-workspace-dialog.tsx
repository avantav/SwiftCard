"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

export function BranchWorkspaceDialog({
  children,
  closeHref = "/admin/branches",
  labelledBy,
}: {
  children: ReactNode;
  closeHref?: string;
  labelledBy: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add("has-branch-modal");
    return () => {
      document.documentElement.classList.remove("has-branch-modal");
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      aria-labelledby={labelledBy}
      className="branch-workspace-dialog"
      onCancel={(event) => {
        event.preventDefault();
        router.replace(closeHref, { scroll: false });
      }}
      ref={dialogRef}
    >
      {children}
    </dialog>
  );
}
