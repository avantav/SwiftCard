import type { ReactNode } from "react";

/**
 * Viewport-contained admin page (DEC-0073). From 640px the page never
 * scrolls: header and toolbar stay put and the body gives its height to one
 * AdminScrollRegion (or a master-detail split). Below 640px it flows
 * naturally. Keeps `enterprise-page` so the shared shell styles apply.
 */
export function AdminWorkspace({ title, titleId = "admin-workspace-title", breadcrumb, description, primaryAction, toolbar, children, className = "" }: {
  title: string;
  titleId?: string;
  breadcrumb?: string;
  description?: string;
  primaryAction?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return <main aria-labelledby={titleId} className={`enterprise-page admin-workspace${toolbar ? " has-toolbar" : ""}${className ? ` ${className}` : ""}`}>
    <header className="enterprise-page-header admin-workspace-header">
      <div>
        {breadcrumb ? <p className="enterprise-breadcrumb">{breadcrumb}</p> : null}
        <h1 id={titleId}>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {primaryAction ? <div className="admin-workspace-actions">{primaryAction}</div> : null}
    </header>
    {toolbar ? <div className="admin-workspace-toolbar">{toolbar}</div> : null}
    <div className="admin-workspace-body">{children}</div>
  </main>;
}

/** The single scrolling area of a workspace panel; keyboard-scrollable. */
export function AdminScrollRegion({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <div aria-label={label} className={`admin-scroll-region${className ? ` ${className}` : ""}`} role="region" tabIndex={0}>{children}</div>;
}

/** List + detail side by side from 1024px; stacked below. */
export function AdminMasterDetail({ master, detail, className = "" }: { master: ReactNode; detail: ReactNode; className?: string }) {
  return <div className={`admin-master-detail${className ? ` ${className}` : ""}`}>
    <div className="admin-master-detail-list">{master}</div>
    <div className="admin-master-detail-panel">{detail}</div>
  </div>;
}
