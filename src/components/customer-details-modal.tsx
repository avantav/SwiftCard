"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

export function CustomerDetailsModal({ backHref, children, customerName, currentStep = 1, totalSteps = 3 }: { backHref?: string; children: ReactNode; customerName: string; currentStep?: number; totalSteps?: number }) {
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
        <div><p>Paso {currentStep} de {totalSteps}</p><h2 id="customer-details-title">{customerName}</h2></div>
        <div className="operations-modal-header-actions">{backHref ? <Link className="operations-modal-back" href={backHref}>Volver</Link> : null}<Link className="operations-modal-close" href="/app/scan">Cerrar</Link></div>
      </header>
      <div className="operations-step-progress" aria-label={`Paso ${currentStep} de ${totalSteps}`}><span style={{ width: `${Math.min(100, Math.max(0, currentStep / totalSteps * 100))}%` }} /></div>
      <div className="operations-search-dialog-body operations-customer-dialog-body">{children}</div>
    </div>
  </dialog>;
}
