"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

export function CustomerDetailsModal({ children, customerName }: { children: ReactNode; customerName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousOverflowRef = useRef("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialog.open) dialog.removeAttribute("open");
    previousOverflowRef.current = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      document.documentElement.style.overflow = previousOverflowRef.current;
    };
  }, []);

  function unlockPageScroll() {
    document.documentElement.style.overflow = previousOverflowRef.current;
  }

  return <dialog
    aria-labelledby="customer-details-title"
    className="operations-search-dialog operations-customer-dialog"
    onCancel={unlockPageScroll}
    onClose={unlockPageScroll}
    open
    ref={dialogRef}
  >
    <div className="operations-search-dialog-shell">
      <header className="operations-search-dialog-header">
        <div><p>Cliente identificado</p><h2 id="customer-details-title">{customerName}</h2></div>
        <Link className="operations-modal-close" href="/app/scan">Cerrar</Link>
      </header>
      <div className="operations-search-dialog-body operations-customer-dialog-body">{children}</div>
    </div>
  </dialog>;
}
