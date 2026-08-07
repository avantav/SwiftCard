"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "primary-button", confirmMessage }: { children: React.ReactNode; className?: string; confirmMessage?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending} onClick={(event) => {
    if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
  }}>{pending ? "Procesando..." : children}</button>;
}
