import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync(new URL("../../app/superadmin/layout.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../../app/superadmin/page.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../../components/superadmin-navigation.tsx", import.meta.url), "utf8");
const statusForm = readFileSync(new URL("../../components/tenant-status-form.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const logoutAction = readFileSync(new URL("../../app/logout/actions.ts", import.meta.url), "utf8");

describe("Superadmin enterprise design contract", () => {
  it("uses the protected reusable shell with visible identity and sign out", () => {
    expect(layout).toContain('requireInternalArea("SUPERADMIN")');
    expect(layout).toContain("SuperadminNavigation");
    expect(layout).toContain('className="enterprise-main"');
    expect(navigation).toContain("aria-current");
    expect(navigation).toContain("Cerrar sesión");
    expect(navigation).toContain('aria-controls="superadmin-navigation"');
    expect(logoutAction).toContain("supabase.auth.signOut()");
  });

  it("renders operational metrics and explicit data states", () => {
    expect(dashboard).toContain("Total de tenants");
    expect(dashboard).toContain("Administradores");
    expect(dashboard).toContain("No se pudieron cargar los tenants");
    expect(dashboard).toContain("Crea tu primer tenant");
    expect(dashboard).toContain('<caption className="sr-only">');
    expect(dashboard).toContain('scope="col"');
  });

  it("protects consequential tenant state changes", () => {
    expect(statusForm).toContain("window.confirm");
    expect(statusForm).toContain("useFormStatus");
    expect(statusForm).toContain("Actualizando…");
  });

  it("includes the required tokens, focus treatment, responsive widths and reduced motion", () => {
    expect(styles).toContain("--enterprise-sidebar-width: 248px");
    expect(styles).toContain("--enterprise-primary: #087f74");
    expect(styles).toContain(":focus-visible");
    expect(styles).toContain("@media (max-width: 1023px)");
    expect(styles).toContain("@media (max-width: 767px)");
    expect(styles).toContain("@media (max-width: 639px)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
