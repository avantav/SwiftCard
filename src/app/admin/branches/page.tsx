import Link from "next/link";
import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { createBranch } from "./actions";

type BranchesPageProps = {
  searchParams: Promise<{ created?: string; error?: string }>;
};

export default async function BranchesPage({ searchParams }: BranchesPageProps) {
  const context = await requireInternalArea("ADMIN");

  if (context.access.role !== "ADMIN") {
    redirect("/admin");
  }

  const { created, error } = await searchParams;
  const { data: branches, error: branchesError } = await context.supabase
    .from("branches")
    .select("id,name,address,status,geofence_radius_meters")
    .order("name");

  return (
    <main className="shell">
      <section className="panel" aria-labelledby="branches-title">
        <Link className="text-link" href="/admin">
          Volver
        </Link>
        <p className="eyebrow">Administrador</p>
        <h1 id="branches-title" className="form-title">
          Sucursales
        </h1>
        {created ? (
          <p className="success-alert" role="status">
            Sucursal creada.
          </p>
        ) : null}
        {error ? (
          <p className="auth-alert" role="alert">
            {error}
          </p>
        ) : null}
        {branchesError ? (
          <p className="auth-alert" role="alert">
            No se pudieron cargar las sucursales.
          </p>
        ) : null}
        <div className="management-grid">
          <div>
            <h2 className="section-title">Sucursales actuales</h2>
            <div className="data-list">
              {branches?.length ? (
                branches.map((branch) => (
                  <div key={branch.id}>
                    <strong>{branch.name}</strong>
                    <span>{branch.address || "Sin dirección"}</span>
                    <span>
                      {branch.status} · {branch.geofence_radius_meters} m
                    </span>
                  </div>
                ))
              ) : (
                <p className="empty-state">No hay sucursales registradas.</p>
              )}
            </div>
          </div>
          <div>
            <h2 className="section-title">Nueva sucursal</h2>
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
              <button className="primary-button" type="submit">
                Crear sucursal
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
