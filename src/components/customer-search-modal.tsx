"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

type CustomerSearchModalProps = {
  children: ReactNode;
  initiallyOpen: boolean;
};

export function CustomerSearchModal({ children, initiallyOpen }: CustomerSearchModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousOverflowRef = useRef("");

  function lockPageScroll() {
    previousOverflowRef.current = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
  }

  function unlockPageScroll() {
    document.documentElement.style.overflow = previousOverflowRef.current;
  }

  function openModal() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    lockPageScroll();
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('input[name="q"]')?.focus();
  }

  function closeModal() {
    dialogRef.current?.close();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
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
    <button
      aria-haspopup="dialog"
      className="operations-secondary-button operations-search-trigger"
      onClick={openModal}
      type="button"
    >
      Buscar cliente por nombre o teléfono
    </button>
    <dialog
      aria-labelledby="customer-search-title"
      className="operations-search-dialog"
      open={initiallyOpen || undefined}
      onCancel={unlockPageScroll}
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
