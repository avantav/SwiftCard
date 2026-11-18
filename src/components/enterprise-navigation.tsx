"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { signOut } from "@/app/logout/actions";

export type EnterpriseIconName =
  | "award"
  | "building"
  | "chart"
  | "close"
  | "download"
  | "file"
  | "home"
  | "import"
  | "logout"
  | "menu"
  | "scan"
  | "search"
  | "shield"
  | "cart"
  | "user-plus"
  | "users"
  | "wallet";

export type EnterpriseNavItem = {
  href: string;
  icon: EnterpriseIconName;
  label: string;
  exact?: boolean;
  matches?: string[];
};

export type EnterpriseNavGroup = {
  label: string;
  items: EnterpriseNavItem[];
};

export function EnterpriseIcon({ name }: { name: EnterpriseIconName }) {
  const paths: Record<EnterpriseIconName, ReactNode> = {
    award: <path d="M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-4 0-1 6 5-3 5 3-1-6" />,
    building: <><path d="M4 20h16" /><path d="M6 20V8l6-4 6 4v12" /><path d="M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01" /></>,
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    import: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    scan: <><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    cart: <><path d="M3 3h2l2.4 11.3a2 2 0 0 0 2 1.7h7.7a2 2 0 0 0 2-1.6L21 7H6" /><circle cx="10" cy="21" r="1" /><circle cx="18" cy="21" r="1" /></>,
    "user-plus": <><path d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    wallet: <><path d="M4 6h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2h14" /><path d="M17 12h4v4h-4a2 2 0 0 1 0-4Z" /></>
  };

  return <svg aria-hidden="true" className="enterprise-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function LogoutButton() {
  const { pending } = useFormStatus();
  return <button className="enterprise-user-action" type="submit" disabled={pending}><EnterpriseIcon name="logout" /><span>{pending ? "Cerrando sesión…" : "Cerrar sesión"}</span></button>;
}

function isCurrentRoute(pathname: string, item: EnterpriseNavItem) {
  if (item.exact) return pathname === item.href;
  if (pathname === item.href) return true;
  const matches = item.matches ?? [item.href];
  return matches.some((match) => pathname === match || pathname.startsWith(`${match}/`));
}

export function EnterpriseNavigation({ areaLabel, email, groups, roleLabel }: { areaLabel: string; email: string | null; groups: EnterpriseNavGroup[]; roleLabel: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);

  // Mobile drawer: Escape closes, focus stays inside, the page behind does
  // not scroll and focus returns to the menu button (DEC-0073).
  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) menuButtonRef.current?.focus();
      wasOpenRef.current = false;
      return;
    }
    wasOpenRef.current = true;
    const sidebar = sidebarRef.current;
    document.documentElement.classList.add("has-open-navigation");
    sidebar?.querySelector<HTMLElement>("a, button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !sidebar) return;
      const focusable = [...sidebar.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.documentElement.classList.remove("has-open-navigation");
    };
  }, [open]);

  const initials = roleLabel.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();

  return <>
    <header className="enterprise-mobile-header">
      <Link className="enterprise-mobile-brand" href={groups[0]?.items[0]?.href ?? "/"}><span className="enterprise-brand-mark" aria-hidden="true"><span>m</span></span><span>morrow</span></Link>
      <button aria-controls="enterprise-navigation" aria-expanded={open} aria-label={open ? "Cerrar navegación" : "Abrir navegación"} className="enterprise-mobile-menu" ref={menuButtonRef} onClick={() => setOpen((current) => !current)} type="button"><EnterpriseIcon name={open ? "close" : "menu"} /></button>
    </header>
    {open ? <button aria-label="Cerrar navegación" className="enterprise-nav-backdrop" onClick={() => setOpen(false)} type="button" /> : null}
    <aside className={`enterprise-sidebar${open ? " is-open" : ""}`} id="enterprise-navigation" ref={sidebarRef}>
      <Link className="enterprise-brand" href={groups[0]?.items[0]?.href ?? "/"} onClick={() => setOpen(false)}><span className="enterprise-brand-mark" aria-hidden="true"><span>m</span></span><span className="enterprise-brand-copy"><strong>morrow</strong><small>{areaLabel}</small></span></Link>
      <div className="enterprise-nav-groups">
        {groups.map((group) => <nav aria-label={group.label} className="enterprise-nav" key={group.label}>
          <p className="enterprise-nav-label">{group.label}</p>
          {group.items.map((item) => {
            const active = isCurrentRoute(pathname, item);
            return <Link aria-current={active ? "page" : undefined} className={`enterprise-nav-link${active ? " is-active" : ""}`} href={item.href} key={item.href} onClick={() => setOpen(false)}><EnterpriseIcon name={item.icon} /><span>{item.label}</span></Link>;
          })}
        </nav>)}
      </div>
      <div className="enterprise-sidebar-footer">
        <div className="enterprise-user"><span className="enterprise-user-avatar" aria-hidden="true">{initials}</span><span className="enterprise-user-copy"><strong>{roleLabel}</strong><small>{email ?? "Cuenta interna"}</small></span></div>
        <form action={signOut}><LogoutButton /></form>
      </div>
    </aside>
  </>;
}
