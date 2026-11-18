"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { NOTICE_PARAM, noticeMessage, withoutNotice, type NoticeCode } from "@/lib/forms/notices";

const TOAST_MS = 6000;

type Toast = { text: string; serial: number } | null;

// Tiny external store so both the URL notice and client code can raise a
// toast without setting React state inside effects.
let current: Toast = null;
let serial = 0;
const listeners = new Set<() => void>();

function emit(next: Toast) {
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function showText(text: string) {
  serial += 1;
  emit({ text, serial });
}

/** Shows a success notice from client code (e.g. after a state action). */
export function showToast(code: NoticeCode) {
  const text = noticeMessage(code);
  if (text) showText(text);
}

/**
 * Brief success confirmation (DEC-0073, DESIGN_SYSTEM §29). Reads a known
 * `?notice=` code, shows its text with role="status" for six seconds and
 * removes the param from the URL. Never renders free text from the URL.
 */
export function ToastRegion() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useSyncExternalStore(subscribe, () => current, () => null);

  useEffect(() => {
    const code = searchParams.get(NOTICE_PARAM);
    if (!code) return;
    const text = noticeMessage(code);
    if (text) showText(text);
    router.replace(withoutNotice(pathname, searchParams.toString()), { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      if (current?.serial === toast.serial) emit(null);
    }, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return <div className="admin-toast-region" role="status">
    {toast ? <div className="admin-toast" key={toast.serial}>
      <svg aria-hidden="true" className="admin-toast-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
      <p>{toast.text}</p>
      <button aria-label="Cerrar aviso" className="admin-toast-close" onClick={() => emit(null)} type="button">Cerrar</button>
    </div> : null}
  </div>;
}
