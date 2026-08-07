"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "primary-button", confirmMessage, disabled = false }: { children: React.ReactNode; className?: string; confirmMessage?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending || disabled} onClick={(event) => {
    if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
  }}>{pending ? "Procesando..." : children}</button>;
}
