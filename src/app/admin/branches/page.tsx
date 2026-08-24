import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { SubmitButton } from "@/components/submit-button";
import { BranchAccessFields } from "@/components/branch-access-fields";
import { BranchCreateForm } from "@/components/branch-create-form";
import { BranchEditForm } from "@/components/branch-edit-form";
import { PublicRegistrationShare } from "@/components/public-registration-share";
import { requireInternalArea } from "@/lib/auth/server";
import {
  publicRegistrationUrl,
  resolvePublicOrigin,
} from "@/lib/public-origin";
import { configureBranchAccess, configureTenantGeofencing } from "./actions";

type BranchesPageProps = {
  searchParams: Promise<{
    accessUpdated?: string;
    created?: string;
    error?: string;
    geofenceUpdated?: string;
    updated?: string;
  }>;
};

export default async function BranchesPage({ searchParams }: BranchesPageProps) {
  const context = await requireInternalArea("ADMIN");

  if (context.access.role !== "ADMIN") {
    redirect("/admin");
  }

  const { accessUpdated, created, error, geofenceUpdated, updated } = await searchParams;
  const [{ data: branches, error: branchesError }, { data: tenant, error: tenantError }] = await Promise.all([
    context.supabase
      .from("branches")
      .select(
        "id,name,address,latitude,longitude,status,geofence_radius_meters,proximity_enabled,proximity_message,employee_access_mode,public_registration_token",
      )
      .order("name"),
    context.supabase
      .from("tenants")
      .select("location_validation_mode")
      .eq("id", context.tenantId)
      .maybeSingle(),
  ]);
  const strictGeofencing = tenant?.location_validation_mode === "STRICT";
  const branchesMissingCoordinates = (branches ?? []).filter(
    (branch) => branch.status === "ACTIVE" && (branch.latitude === null || branch.longitude === null),
  );
  const publicOrigin = resolvePublicOrigin(
    process.env.SWIFTWALLET_PUBLIC_URL,
  );
  const branchesWithRegistration = await Promise.all(
    (branches ?? []).map(async (branch) => {
      if (!publicOrigin || !branch.public_registration_token) {
        return { ...branch, qrDataUrl: null, registrationUrl: null };
      }
      try {
        const registrationUrl = publicRegistrationUrl(
          publicOrigin,
          branch.public_registration_token,
        );
        const qrDataUrl = await QRCode.toDataURL(registrationUrl, {
          color: { dark: "#111827", light: "#ffffff" },
          errorCorrectionLevel: "M",
          margin: 2,
          width: 512,
        });
        return { ...branch, qrDataUrl, registrationUrl };
      } catch {
        return { ...branch, qrDataUrl: null, registrationUrl: null };
      }
    }),
  );

  return (
    <main className="enterprise-page">
      <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Configuración</p><h1 id="branches-title">Sucursales</h1><p>Administra ubicaciones, proximidad y radio operativo.</p></div><a className="enterprise-primary-action" href="#new-branch">Crear sucursal</a></header>
        {created ? (
          <p className="enterprise-alert is-success" role="status">
            Sucursal creada.
          </p>
        ) : null}
        {updated ? (
          <p className="enterprise-alert is-success" role="status">
            Sucursal actualizada.
          </p>
        ) : null}
        {accessUpdated ? <p className="enterprise-alert is-success" role="status">Modo de acceso actualizado y sesiones incompatibles revocadas.</p> : null}
        {geofenceUpdated ? <p className="enterprise-alert is-success" role="status">Validación de ubicación actualizada.</p> : null}
        {error ? (
          <p className="enterprise-alert is-error" role="alert">
            {error}
          </p>
        ) : null}
        <section className="enterprise-content-card branch-geofence-control" aria-labelledby="tenant-geofence-title">
          <div>
            <span className={`enterprise-badge ${strictGeofencing ? "is-active" : "is-neutral"}`}>{strictGeofencing ? "Geofence activo" : "Geofence desactivado"}</span>
            <h2 id="tenant-geofence-title">Validación GPS de operaciones</h2>
            <p>{strictGeofencing ? "Compras y canjes requieren el GPS del dispositivo dentro del radio configurado." : "En modo flexible las operaciones no se bloquean por ubicación, aunque la sucursal tenga coordenadas."}</p>
            {!strictGeofencing && branchesMissingCoordinates.length ? <small>{branchesMissingCoordinates.length} {branchesMissingCoordinates.length === 1 ? "sucursal activa necesita" : "sucursales activas necesitan"} una ubicación antes de poder activarlo.</small> : null}
            <small>La proximidad de Apple Wallet es independiente: puede mostrar avisos cercanos, pero no bloquea operaciones.</small>
          </div>
          {tenantError ? <p className="enterprise-alert is-error" role="alert">No se pudo consultar el modo de validación.</p> : <form action={configureTenantGeofencing}>
            <input name="locationValidationMode" type="hidden" value={strictGeofencing ? "FLEXIBLE" : "STRICT"} />
            <SubmitButton
              className={strictGeofencing ? "secondary-button" : "primary-button"}
              confirmMessage={strictGeofencing ? "Las operaciones dejarán de validar la ubicación. ¿Deseas continuar?" : "Las compras y canjes fuera del radio serán bloqueados. ¿Deseas activar el geofence?"}
              disabled={!strictGeofencing && branchesMissingCoordinates.length > 0}
            >{strictGeofencing ? "Desactivar geofence" : "Activar geofence"}</SubmitButton>
          </form>}
        </section>
        <div className="admin-management-grid">
          <section className="enterprise-data-panel" aria-labelledby="branch-list-title">
            <div className="enterprise-panel-header"><div><h2 id="branch-list-title">Sucursales actuales</h2><p>{branches?.length ?? 0} {(branches?.length ?? 0) === 1 ? "ubicación" : "ubicaciones"}</p></div></div>
            <div className="admin-record-list">
              {branchesError ? <div className="enterprise-empty-state is-error admin-compact-empty" role="alert"><span className="enterprise-empty-icon" aria-hidden="true">!</span><h3>No se pudieron cargar las sucursales</h3><p>Actualiza la página para volver a intentarlo.</p></div> : branchesWithRegistration.length ? (
                branchesWithRegistration.map((branch) => (
                  <article key={branch.id} className="admin-record">
                    <div><strong>{branch.name}</strong><span>{branch.address || "Sin dirección registrada"}</span></div>
                    <div className="admin-record-meta"><span className={`enterprise-badge ${branch.status === "ACTIVE" ? "is-active" : "is-suspended"}`}>{branch.status === "ACTIVE" ? "Activa" : "Inactiva"}</span><span>{branch.geofence_radius_meters} m de radio</span><span>{branch.employee_access_mode === "SHARED_ACCOUNT_PIN" ? "Cuenta compartida + PIN" : "Cuentas individuales"}</span></div>
                    <details className="admin-inline-details">
                      <summary>Editar sucursal</summary>
                      <BranchEditForm branch={branch} />
                    </details>
                    <details className="admin-inline-details">
                      <summary>Enlace y QR de registro</summary>
                      <div className="admin-registration-details">
                        {branch.status !== "ACTIVE" ? (
                          <p className="enterprise-alert is-warning">
                            Activa la sucursal para habilitar su registro público.
                          </p>
                        ) : branch.registrationUrl && branch.qrDataUrl ? (
                          <PublicRegistrationShare
                            branchName={branch.name}
                            qrDataUrl={branch.qrDataUrl}
                            registrationUrl={branch.registrationUrl}
                          />
                        ) : (
                          <p className="enterprise-alert is-error" role="alert">
                            Configura SWIFTWALLET_PUBLIC_URL con el dominio HTTPS de la aplicación para generar este enlace.
                          </p>
                        )}
                      </div>
                    </details>
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
            <BranchCreateForm />
          </section>
        </div>
    </main>
  );
}
