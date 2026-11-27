import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/branches",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const { AdminMasterDetail, AdminScrollRegion, AdminWorkspace } = await import("./admin-workspace");
const { AdminTabs, activeTab, tabHref } = await import("./admin-tabs");
const { WizardForm } = await import("./wizard-form");
const { FormErrorSummary, describedBy } = await import("./form-field");
const { WorkspaceDialogHeader } = await import("./workspace-dialog");
const { initialFormState } = await import("@/lib/forms/state");

describe("admin workspace", () => {
  it("renders one h1, the optional toolbar and a keyboard-scrollable region", () => {
    const html = renderToStaticMarkup(<AdminWorkspace title="Sucursales" breadcrumb="Configuración" description="Administra tus ubicaciones." toolbar={<span>filtros</span>} primaryAction={<a href="/x">Crear sucursal</a>}>
      <AdminScrollRegion label="Inventario de sucursales"><table><thead><tr><th>Nombre</th></tr></thead></table></AdminScrollRegion>
    </AdminWorkspace>);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('class="enterprise-page admin-workspace has-toolbar"');
    expect(html).toContain('aria-labelledby="admin-workspace-title"');
    expect(html).toContain('role="region" tabindex="0"');
    expect(html).toContain('aria-label="Inventario de sucursales"');
    expect(renderToStaticMarkup(<AdminWorkspace title="X"><p /></AdminWorkspace>)).not.toContain("has-toolbar");
    expect(renderToStaticMarkup(<AdminMasterDetail master={<p>lista</p>} detail={<p>detalle</p>} />)).toContain("admin-master-detail-panel");
  });
});

describe("URL tabs", () => {
  it("keeps other params, drops the default tab and marks the current one", () => {
    expect(tabHref("/admin/branches", "tab", "ubicacion", { branch: "b1", tab: "old" })).toBe("/admin/branches?branch=b1&tab=ubicacion");
    expect(tabHref("/admin/branches", "tab", null, { branch: "b1" })).toBe("/admin/branches?branch=b1");
    const html = renderToStaticMarkup(<AdminTabs label="Secciones" baseHref="/admin/branches" active="ubicacion" tabs={[{ id: "sucursales", label: "Sucursales", count: 3 }, { id: "ubicacion", label: "Ubicación" }]} />);
    expect(html).toContain('href="/admin/branches"');
    expect(html).toContain('aria-current="page" class="admin-tab is-active" href="/admin/branches?tab=ubicacion"');
    expect(html).toContain('<span class="admin-tab-count">3</span>');
    expect(activeTab("nope", ["sucursales", "ubicacion"] as const)).toBe("sucursales");
    expect(activeTab(["ubicacion"], ["sucursales", "ubicacion"] as const)).toBe("ubicacion");
  });
});

describe("guided wizard", () => {
  it("mounts every step, shows only the first and a single primary action", () => {
    const html = renderToStaticMarkup(<WizardForm
      steps={[{ id: "a", title: "Identidad", fields: ["name"] }, { id: "b", title: "Ubicación", fields: ["address"] }, { id: "c", title: "Acceso", fields: ["mode"] }]}
      action={async (state) => state}
      initialState={initialFormState({ name: "" })}
      submitLabel="Crear sucursal"
      errorTitle="No se pudo crear la sucursal"
      cancelHref="/admin/branches"
    >{() => [<input key="a" name="name" />, <input key="b" name="address" />, <input key="c" name="mode" />]}</WizardForm>);
    expect(html).toContain("Paso 1 de 3");
    expect(html).toContain('data-steps="3"');
    expect(html.match(/data-wizard-step=/g)).toHaveLength(3);
    expect(html.match(/hidden=""/g)).toHaveLength(2);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain(">Continuar</button>");
    expect(html).not.toContain("Crear sucursal");
    expect(html).toContain('href="/admin/branches"');
    expect(html).toContain('noValidate=""');
  });
});

describe("form fields and dialog header", () => {
  it("builds describedby ids and an alert summary with unique messages", () => {
    expect(describedBy("hint", "err", true)).toBe("hint err");
    expect(describedBy(null, "err", false)).toBeUndefined();
    const html = renderToStaticMarkup(<FormErrorSummary title="No se pudo guardar" formError="Intenta de nuevo." fieldErrors={{ a: ["Uno"], b: ["Uno", "Dos"] }} active />);
    expect(html).toContain('role="alert"');
    expect(html.match(/<li>/g)).toHaveLength(2);
    expect(renderToStaticMarkup(<FormErrorSummary title="x" active={false} formError="y" />)).toBe("");
  });

  it("gives every dialog a visible close action", () => {
    const html = renderToStaticMarkup(<WorkspaceDialogHeader eyebrow="Sucursales" title="Nueva sucursal" titleId="t" closeHref="/admin/branches" />);
    expect(html).toContain('<h2 id="t">Nueva sucursal</h2>');
    expect(html).toContain('class="enterprise-dialog-close" href="/admin/branches"');
  });

  it("guards typed changes, restores focus and closes from the backdrop", () => {
    const dialog = readFileSync("src/components/admin/workspace-dialog.tsx", "utf8");
    expect(dialog).toContain("window.confirm(DIRTY_MESSAGE)");
    expect(dialog).toContain("opener.focus()");
    expect(dialog).toContain("if (!inside) requestClose()");
    expect(dialog).toContain('router.replace(closeHref, { scroll: false })');
  });
});

describe("workspace layout contract", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const layout = readFileSync("src/app/admin/layout.tsx", "utf8");
  const navigation = readFileSync("src/components/enterprise-navigation.tsx", "utf8");

  it("locks the viewport from 640px with one offset variable", () => {
    expect(css).toContain("--admin-offset: calc(var(--admin-header-h) + var(--admin-banner-h));");
    expect(css).toContain(".enterprise-app.is-admin-app.has-support-session {\n  --admin-banner-h: 64px;");
    expect(css).toMatch(/@media \(min-width: 640px\) \{\n {2}\.admin-workspace \{\n {4}height: calc\(100dvh - var\(--admin-offset, 0px\)\);\n {4}overflow: hidden;/);
    expect(css).not.toContain("height: calc(100dvh - 64px);");
    expect(css).toContain(".admin-scroll-region thead th {\n  position: sticky;");
    expect(layout).toContain("is-admin-app");
    expect(layout).toContain("<ToastRegion />");
  });

  it("makes the mobile drawer dismissable and keeps focus inside", () => {
    expect(navigation).toContain('event.key === "Escape"');
    expect(navigation).toContain('event.key !== "Tab"');
    expect(navigation).toContain("has-open-navigation");
    expect(navigation).toContain("menuButtonRef.current?.focus()");
  });
});
