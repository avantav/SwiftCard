"use client";

import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

export function PendingLinkContent({ children, label = "Cargando" }: { children: ReactNode; label?: string }) {
  const { pending } = useLinkStatus();

  return <span className="pending-link-content">
    <span aria-hidden={pending || undefined} className={pending ? "is-hidden" : undefined}>{children}</span>
    {pending ? <span className="pending-link-indicator" role="status"><span aria-hidden="true" className="enterprise-spinner" /><span className="sr-only">{label}</span></span> : null}
  </span>;
}
