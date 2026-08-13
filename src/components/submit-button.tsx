"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "primary-button", confirmMessage, disabled = false, name, value }: { children: React.ReactNode; className?: string; confirmMessage?: string; disabled?: boolean; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending || disabled} name={name} value={value} onClick={(event) => {
    if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
  }}>{pending ? "Procesando..." : children}</button>;
}
