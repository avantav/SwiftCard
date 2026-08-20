"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

type CustomerSearchModalProps = {
  children: ReactNode;
  initiallyOpen: boolean;
};

export function CustomerSearchModal({ children, initiallyOpen }: CustomerSearchModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousOverflowRef = useRef("");
  const router = useRouter();

  function unlockPageScroll() {
    document.documentElement.style.overflow = previousOverflowRef.current;
  }

  function closeModal() {
    dialogRef.current?.close();
    router.replace("/app/scan");
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!initiallyOpen && dialog?.open) dialog.close();
    if (initiallyOpen && dialog) {
      if (dialog.open) dialog.removeAttribute("open");
      previousOverflowRef.current = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>('input[name="q"]')?.focus();
    }
    return () => {
      document.documentElement.style.overflow = previousOverflowRef.current;
    };
  }, [initiallyOpen]);

  return <>
    <Link
      aria-haspopup="dialog"
      className="operations-secondary-button operations-search-trigger"
      href="/app/scan?searchModal=1"
    >
      Buscar cliente por nombre o teléfono
    </Link>
    <dialog
      aria-labelledby="customer-search-title"
      className="operations-search-dialog"
      open={initiallyOpen || undefined}
      onCancel={(event) => {
        event.preventDefault();
        closeModal();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
      onClose={unlockPageScroll}
      ref={dialogRef}
    >
      <div className="operations-search-dialog-shell">
        <header className="operations-search-dialog-header">
          <div><p>Clientes</p><h2 id="customer-search-title">Buscar cliente</h2></div>
          <button className="operations-modal-close" onClick={closeModal} type="button">Cerrar</button>
        </header>
        <div className="operations-search-dialog-body">{children}</div>
      </div>
    </dialog>
  </>;
}
