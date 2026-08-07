import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { BranchAccessFields } from "@/components/branch-access-fields";
import { requireInternalArea } from "@/lib/auth/server";
import { configureBranchAccess, createBranch } from "./actions";

type BranchesPageProps = {
  searchParams: Promise<{ accessUpdated?: string; created?: string; error?: string }>;
};

export default async function BranchesPage({ searchParams }: BranchesPageProps) {
  const context = await requireInternalArea("ADMIN");

  if (context.access.role !== "ADMIN") {
    redirect("/admin");
  }

  const { accessUpdated, created, error } = await searchParams;
  const { data: branches, error: branchesError } = await context.supabase
    .from("branches")
    .select("id,name,address,status,geofence_radius_meters,employee_access_mode")
    .order("name");

  return (
    <main className="enterprise-page">
      <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Configuración</p><h1 id="branches-title">Sucursales</h1><p>Administra ubicaciones, proximidad y radio operativo.</p></div><a className="enterprise-primary-action" href="#new-branch">Crear sucursal</a></header>
        {created ? (
          <p className="enterprise-alert is-success" role="status">
            Sucursal creada.
          </p>
        ) : null}
        {accessUpdated ? <p className="enterprise-alert is-success" role="status">Modo de acceso actualizado y sesiones incompatibles revocadas.</p> : null}
        {error ? (
          <p className="enterprise-alert is-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="admin-management-grid">
          <section className="enterprise-data-panel" aria-labelledby="branch-list-title">
            <div className="enterprise-panel-header"><div><h2 id="branch-list-title">Sucursales actuales</h2><p>{branches?.length ?? 0} {(branches?.length ?? 0) === 1 ? "ubicación" : "ubicaciones"}</p></div></div>
            <div className="admin-record-list">
              {branchesError ? <div className="enterprise-empty-state is-error admin-compact-empty" role="alert"><span className="enterprise-empty-icon" aria-hidden="true">!</span><h3>No se pudieron cargar las sucursales</h3><p>Actualiza la página para volver a intentarlo.</p></div> : branches?.length ? (
                branches.map((branch) => (
                  <article key={branch.id} className="admin-record">
                    <div><strong>{branch.name}</strong><span>{branch.address || "Sin dirección registrada"}</span></div>
                    <div className="admin-record-meta"><span className={`enterprise-badge ${branch.status === "ACTIVE" ? "is-active" : "is-suspended"}`}>{branch.status === "ACTIVE" ? "Activa" : "Inactiva"}</span><span>{branch.geofence_radius_meters} m de radio</span><span>{branch.employee_access_mode === "SHARED_ACCOUNT_PIN" ? "Cuenta compartida + PIN" : "Cuentas individuales"}</span></div>
                    <details className="admin-inline-details"><summary>Configurar acceso del personal</summary><form className="auth-form admin-inline-form" action={configureBranchAccess}><input type="hidden" name="branchId" value={branch.id} /><BranchAccessFields compact defaultMode={branch.employee_access_mode} /><SubmitButton className="secondary-button" confirmMessage="Cambiar el modo revocará las sesiones incompatibles de esta sucursal. ¿Deseas continuar?">Guardar modo de acceso</SubmitButton></form></details>
                  </article>
                ))
              ) : (
                <div className="enterprise-empty-state admin-compact-empty"><span className="enterprise-empty-icon" aria-hidden="true">+</span><h3>Crea la primera sucursal</h3><p>Define una ubicación para asignar personal y operar el programa.</p></div>
              )}
            </div>
          </section>
          <section className="enterprise-content-card admin-form-card" id="new-branch" aria-labelledby="new-branch-title">
            <h2 id="new-branch-title" className="admin-card-title">Nueva sucursal</h2>
            <p className="admin-card-copy">Los datos de ubicación se usarán para geofence y proximidad.</p>
            <form className="auth-form" action={createBranch}>
              <label className="field">
                <span>Nombre</span>
                <input name="name" required />
              </label>
              <label className="field">
                <span>Dirección</span>
                <input name="address" />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>Latitud</span>
                  <input name="latitude" type="number" step="any" />
                </label>
                <label className="field">
                  <span>Longitud</span>
                  <input name="longitude" type="number" step="any" />
                </label>
              </div>
              <label className="field">
                <span>Radio de geofence (metros)</span>
                <input
                  name="geofenceRadiusMeters"
                  type="number"
                  min={1}
                  max={100000}
                  defaultValue={100}
                  required
                />
              </label>
              <label className="check-field">
                <input
                  name="proximityEnabled"
                  type="checkbox"
                  defaultChecked
                />
                <span>Proximidad habilitada</span>
              </label>
              <BranchAccessFields />
              <SubmitButton>Crear sucursal</SubmitButton>
            </form>
          </section>
        </div>
    </main>
  );
}
