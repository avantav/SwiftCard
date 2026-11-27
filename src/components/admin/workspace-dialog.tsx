"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef } from "react";

const DIRTY_MESSAGE = "Hay cambios sin guardar. ¿Quieres salir sin guardarlos?";

/**
 * URL-driven modal for admin workspaces (DEC-0073). The server renders it
 * from searchParams; closing (Escape, backdrop click or the header button)
 * navigates to `closeHref` without a full reload. Typed changes ask before
 * leaving, focus returns to the element that opened it and the page behind
 * does not scroll.
 */
export function WorkspaceDialog({ children, closeHref, labelledBy, size = "md", className = "" }: {
  children: ReactNode;
  closeHref: string;
  labelledBy: string;
  size?: "md" | "lg" | "full";
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dirtyRef = useRef(false);
  const router = useRouter();

  const requestClose = useCallback(() => {
    if (dirtyRef.current && !window.confirm(DIRTY_MESSAGE)) return;
    router.replace(closeHref, { scroll: false });
  }, [closeHref, router]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add("has-branch-modal", "has-admin-modal");
    return () => {
      document.documentElement.classList.remove("has-branch-modal", "has-admin-modal");
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return <dialog
    aria-labelledby={labelledBy}
    className={`branch-workspace-dialog workspace-dialog is-${size}${className ? ` ${className}` : ""}`}
    onCancel={(event) => {
      event.preventDefault();
      requestClose();
    }}
    onClick={(event) => {
      // Only a click on the backdrop (outside the dialog box) closes it.
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
      if (!inside) requestClose();
    }}
    onInput={() => {
      dirtyRef.current = true;
    }}
    onSubmit={() => {
      dirtyRef.current = false;
    }}
    ref={dialogRef}
  >
    {children}
  </dialog>;
}

/** Standard dialog header: eyebrow, title, optional description and a visible close action. */
export function WorkspaceDialogHeader({ eyebrow, title, titleId, description, closeHref, closeLabel = "Cerrar" }: {
  eyebrow?: string;
  title: string;
  titleId: string;
  description?: string;
  closeHref: string;
  closeLabel?: string;
}) {
  return <header className="workspace-dialog-header">
    <div>
      {eyebrow ? <p className="enterprise-breadcrumb">{eyebrow}</p> : null}
      <h2 id={titleId}>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
    <Link className="enterprise-dialog-close" href={closeHref} replace scroll={false}>{closeLabel}</Link>
  </header>;
}
