import Link from "next/link";

export type AdminTab = { id: string; label: string; count?: number };

/** Builds an internal href replacing one query param and keeping the rest. */
export function tabHref(baseHref: string, param: string, value: string | null, keep: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [key, current] of Object.entries(keep)) {
    if (current && key !== param) params.set(key, current);
  }
  if (value) params.set(param, value);
  const query = params.toString();
  return `${baseHref}${query ? `?${query}` : ""}`;
}

/**
 * Section switcher whose state lives in the URL (DEC-0073): each tab is a
 * soft-navigation link, so back/forward and shared links keep working. The
 * first tab is the default and drops the param.
 */
export function AdminTabs({ label, tabs, active, baseHref, param = "tab", keep = {} }: {
  label: string;
  tabs: readonly AdminTab[];
  active: string;
  baseHref: string;
  param?: string;
  keep?: Record<string, string | undefined>;
}) {
  return <nav aria-label={label} className="admin-tabs">
    {tabs.map((tab, index) => {
      const current = tab.id === active;
      return <Link
        aria-current={current ? "page" : undefined}
        className={`admin-tab${current ? " is-active" : ""}`}
        href={tabHref(baseHref, param, index === 0 ? null : tab.id, keep)}
        key={tab.id}
        scroll={false}
      >
        <span>{tab.label}</span>
        {typeof tab.count === "number" ? <span className="admin-tab-count">{tab.count}</span> : null}
      </Link>;
    })}
  </nav>;
}

/** Validates a tab param against the known ids, falling back to the first. */
export function activeTab<T extends string>(value: string | string[] | undefined, ids: readonly T[]): T {
  const candidate = Array.isArray(value) ? value[0] : value;
  return ids.includes(candidate as T) ? (candidate as T) : ids[0]!;
}
