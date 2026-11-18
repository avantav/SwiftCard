import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { AdminScrollRegion, AdminWorkspace } from "@/components/admin/admin-workspace";
import { BranchCreateForm } from "@/components/branch-create-form";
import { BranchEditForm } from "@/components/branch-edit-form";
import { BranchAccessForm, GeofencePolicyForm } from "@/components/branch-settings-forms";
import { BranchWorkspaceDialog } from "@/components/branch-workspace-dialog";
import { PendingLinkContent } from "@/components/pending-link-content";
import { PublicRegistrationShare } from "@/components/public-registration-share";
import { requireInternalArea } from "@/lib/auth/server";
import {
  publicRegistrationUrl,
  resolvePublicOrigin,
} from "@/lib/public-origin";

type BranchesPageProps = {
  searchParams: Promise<{
    branch?: string;
    error?: string;
    section?: string;
    view?: string;
  }>;
};

const workspaceSections = ["details", "registration", "access"] as const;
type WorkspaceSection = (typeof workspaceSections)[number];

function workspaceHref(branchId: string, section: WorkspaceSection) {
  return `/admin/branches?branch=${encodeURIComponent(branchId)}&section=${section}`;
}

export default async function BranchesPage({ searchParams }: BranchesPageProps) {
  const context = await requireInternalArea("ADMIN");

  if (context.access.role !== "ADMIN") {
    redirect("/admin");
  }

  const readOnlySupport = Boolean(context.supportSession);
  const params = await searchParams;
  const [{ data: branches, error: branchesError }, { data: tenant, error: tenantError }] = await Promise.all([
    context.supabase
      .from("branches")
      .select(
        "id,name,address,latitude,longitude,status,geofence_radius_meters,proximity_enabled,proximity_message,employee_access_mode,public_registration_token",
      )
      .eq("tenant_id", context.tenantId)
      .order("name"),
    context.supabase
      .from("tenants")
      .select("location_validation_mode")
      .eq("id", context.tenantId)
      .maybeSingle(),
  ]);
  const branchRows = branches ?? [];
  const strictGeofencing = tenant?.location_validation_mode === "STRICT";
  const activeBranches = branchRows.filter((branch) => branch.status === "ACTIVE");
  const branchesMissingCoordinates = activeBranches.filter(
    (branch) => branch.latitude === null || branch.longitude === null,
  );
  const publicOrigin = resolvePublicOrigin(process.env.SWIFTWALLET_PUBLIC_URL);
  const selectedBranch = branchRows.find((branch) => branch.id === params.branch) ?? null;
  const showCreate = params.view === "create" || (!branchesError && branchRows.length === 0);
  const showPolicy = params.view === "policy";
  const requestedSection = workspaceSections.find((section) => section === params.section);
  const activeSection: WorkspaceSection = readOnlySupport && requestedSection === "access" ? "details" : requestedSection ?? "details";
  const policyLabel = strictGeofencing ? "Estricto" : "Flexible";
  const policyTooltip = strictGeofencing
    ? "El GPS bloquea compras y canjes fuera del radio configurado."
    : branchesMissingCoordinates.length
      ? `${branchesMissingCoordinates.length} ${branchesMissingCoordinates.length === 1 ? "sucursal activa necesita" : "sucursales activas necesitan"} ubicación antes de activar el modo estricto.`
      : "El GPS se registra como referencia y no bloquea operaciones.";
  let registrationUrl: string | null = null;
  let qrDataUrl: string | null = null;

  if (selectedBranch && publicOrigin && selectedBranch.public_registration_token) {
    try {
      registrationUrl = publicRegistrationUrl(publicOrigin, selectedBranch.public_registration_token);
      qrDataUrl = await QRCode.toDataURL(registrationUrl, {
        color: { dark: "#111827", light: "#ffffff" },
        errorCorrectionLevel: "M",
        margin: 2,
        width: 512,
      });
    } catch {
      registrationUrl = null;
      qrDataUrl = null;
    }
  }

  const notices = readOnlySupport || params.error ? <>
    {readOnlySupport ? <p className="enterprise-alert is-warning" role="status">Modo soporte activo: puedes cambiar sucursales y ubicación/GPS. Las demás configuraciones permanecen protegidas.</p> : null}
    {params.error ? <p className="enterprise-alert is-error" role="alert">{params.error}</p> : null}
  </> : undefined;

  return (
    <AdminWorkspace
      breadcrumb="Configuración"
      className="branches-control-page"
      description="Prepara cada ubicación para operar, registrar clientes y asignar personal."
      primaryAction={<div className="branch-header-actions">
        {tenantError ? <span className="branch-policy-trigger is-disabled" role="alert">GPS no disponible</span> : (
          <Link aria-label={`Política GPS: ${policyLabel}. ${policyTooltip}`} className="branch-policy-trigger" data-tooltip={policyTooltip} href="/admin/branches?view=policy" scroll={false}>
            <PendingLinkContent label="Abriendo política GPS"><span className="branch-policy-info-icon" aria-hidden="true">i</span><span>GPS</span><span className={`enterprise-badge ${strictGeofencing ? "is-active" : "is-neutral"}`}>{policyLabel}</span></PendingLinkContent>
          </Link>
        )}
        <Link className="enterprise-primary-action" href="/admin/branches?view=create" scroll={false}><PendingLinkContent label="Abriendo formulario">Crear sucursal</PendingLinkContent></Link>
      </div>}
      title="Sucursales"
      titleId="branches-title"
      toolbar={notices}
    >
      <section className="enterprise-data-panel branches-inventory-panel" aria-labelledby="branch-list-title">
        <div className="enterprise-panel-header">
          <div><h2 id="branch-list-title">Inventario de sucursales</h2><p>{branchRows.length} {branchRows.length === 1 ? "ubicación configurada" : "ubicaciones configuradas"}</p></div>
        </div>
        {branchesError ? (
          <div className="enterprise-empty-state is-error admin-compact-empty" role="alert"><span className="enterprise-empty-icon" aria-hidden="true">!</span><h3>No se pudieron cargar las sucursales</h3><p>Actualiza la página para volver a intentarlo.</p></div>
        ) : branchRows.length ? (
          <AdminScrollRegion className="enterprise-table-wrap" label="Inventario de sucursales">
            <table className="enterprise-table branch-inventory-table">
              <caption className="sr-only">Estado operativo y configuración de cada sucursal</caption>
              <thead><tr><th scope="col">Sucursal</th><th scope="col">Estado</th><th scope="col">Ubicación</th><th scope="col">Registro público</th><th scope="col">Acceso</th><th scope="col"><span className="sr-only">Acción</span></th></tr></thead>
              <tbody>
                {branchRows.map((branch) => {
                  const hasLocation = branch.latitude !== null && branch.longitude !== null;
                  const registrationReady = branch.status === "ACTIVE" && Boolean(publicOrigin && branch.public_registration_token);
                  return (
                    <tr className={selectedBranch?.id === branch.id ? "is-selected" : undefined} key={branch.id}>
                      <td data-label="Sucursal"><div className="branch-name-cell"><strong>{branch.name}</strong><small>{branch.address || "Sin dirección registrada"}</small></div></td>
                      <td data-label="Estado"><span className={`enterprise-badge ${branch.status === "ACTIVE" ? "is-active" : "is-suspended"}`}>{branch.status === "ACTIVE" ? "Activa" : "Inactiva"}</span></td>
                      <td data-label="Ubicación"><div className="branch-table-stack"><strong>{hasLocation ? `${branch.geofence_radius_meters} m de radio` : "Pendiente"}</strong><small>{hasLocation ? (branch.proximity_enabled ? "Proximidad activa" : "Sin avisos de proximidad") : "Selecciona un punto en el mapa"}</small></div></td>
                      <td data-label="Registro público"><span className={`enterprise-badge ${registrationReady ? "is-active" : "is-neutral"}`}>{registrationReady ? "Disponible" : branch.status === "INACTIVE" ? "Pausado" : "No disponible"}</span></td>
                      <td data-label="Acceso"><div className="branch-table-stack"><strong>{branch.employee_access_mode === "SHARED_ACCOUNT_PIN" ? "Cuenta compartida" : "Cuentas individuales"}</strong><small>{branch.employee_access_mode === "SHARED_ACCOUNT_PIN" ? "Identificación por PIN" : "Correo y contraseña por persona"}</small></div></td>
                      <td className="enterprise-row-actions" data-label="Acción"><Link className="enterprise-secondary-action" href={workspaceHref(branch.id, "details")} aria-current={selectedBranch?.id === branch.id ? "page" : undefined}><PendingLinkContent label={`Abriendo ${branch.name}`}>{selectedBranch?.id === branch.id ? "Administrando" : "Administrar"}</PendingLinkContent></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AdminScrollRegion>
        ) : (
          <div className="enterprise-empty-state admin-compact-empty"><span className="enterprise-empty-icon" aria-hidden="true">+</span><h3>Crea tu primera sucursal</h3><p>Una sucursal conecta clientes, personal, ubicación y operación.</p><Link className="enterprise-primary-action" href="/admin/branches?view=create"><PendingLinkContent label="Abriendo formulario">Crear sucursal</PendingLinkContent></Link></div>
        )}
      </section>

      {showCreate || showPolicy || selectedBranch || params.branch ? (
        <BranchWorkspaceDialog labelledBy="branch-workspace-title">
          {showPolicy ? (
            <div className="enterprise-content-card branch-policy-dialog">
              <div className="branch-workspace-heading"><div><p className="enterprise-breadcrumb">Configuración global</p><h2 id="branch-workspace-title">Política GPS de operaciones</h2><p>Decide si la distancia solo se registra o también bloquea compras y canjes.</p></div><Link className="enterprise-secondary-action" href="/admin/branches">Cerrar</Link></div>
              <div className="branch-policy-choice">
                <span className={`enterprise-badge ${strictGeofencing ? "is-active" : "is-neutral"}`}>{strictGeofencing ? "Validación estricta" : "Validación flexible"}</span>
                <div><strong>{strictGeofencing ? "Se exige estar dentro del radio" : "La ubicación se usa como referencia"}</strong><p>{strictGeofencing ? "Cada compra y canje requiere GPS y se rechaza fuera del radio configurado para la sucursal." : "Las operaciones continúan aunque el dispositivo no comparta ubicación o esté fuera del radio."}</p></div>
              </div>
              {!strictGeofencing && branchesMissingCoordinates.length ? <p className="enterprise-alert is-warning" role="status">Completa la ubicación de {branchesMissingCoordinates.length} {branchesMissingCoordinates.length === 1 ? "sucursal activa" : "sucursales activas"} antes de usar la política estricta.</p> : null}
              <p className="branch-policy-note">Los avisos de proximidad de Wallet son independientes y nunca autorizan una operación.</p>
              <GeofencePolicyForm disabled={!strictGeofencing && branchesMissingCoordinates.length > 0} strict={strictGeofencing} />
            </div>
          ) : showCreate ? (
          <div className="enterprise-content-card branch-workspace-card">
            <div className="branch-workspace-heading"><div><p className="enterprise-breadcrumb">Nueva ubicación</p><h2 id="branch-workspace-title">Crear sucursal</h2><p>Define identidad, ubicación y acceso inicial en un solo flujo.</p></div><Link className="enterprise-secondary-action" href="/admin/branches">Cancelar</Link></div>
            <BranchCreateForm supportMode={readOnlySupport} />
          </div>
        ) : selectedBranch ? (
          <div className="enterprise-data-panel branch-workspace-panel">
            <div className="branch-workspace-heading">
              <div><p className="enterprise-breadcrumb">Administrar sucursal</p><h2 id="branch-workspace-title">{selectedBranch.name}</h2><p>{selectedBranch.address || "Completa la ubicación para habilitar todas las funciones."}</p></div>
              <div className="branch-workspace-heading-actions"><span className={`enterprise-badge ${selectedBranch.status === "ACTIVE" ? "is-active" : "is-suspended"}`}>{selectedBranch.status === "ACTIVE" ? "Activa" : "Inactiva"}</span><Link className="enterprise-secondary-action" href="/admin/branches">Cerrar</Link></div>
            </div>
            <nav className="branch-workspace-nav" aria-label={`Configuración de ${selectedBranch.name}`}>
              <Link aria-current={activeSection === "details" ? "page" : undefined} className={activeSection === "details" ? "is-active" : undefined} href={workspaceHref(selectedBranch.id, "details")}><PendingLinkContent>Datos y ubicación</PendingLinkContent></Link>
              <Link aria-current={activeSection === "registration" ? "page" : undefined} className={activeSection === "registration" ? "is-active" : undefined} href={workspaceHref(selectedBranch.id, "registration")}><PendingLinkContent>Registro público</PendingLinkContent></Link>
              {!readOnlySupport ? <Link aria-current={activeSection === "access" ? "page" : undefined} className={activeSection === "access" ? "is-active" : undefined} href={workspaceHref(selectedBranch.id, "access")}><PendingLinkContent>Acceso del personal</PendingLinkContent></Link> : null}
            </nav>
            <div className="branch-workspace-body">
              {activeSection === "details" ? <BranchEditForm branch={selectedBranch} /> : null}
              {activeSection === "registration" ? (
                <div className="branch-workspace-section">
                  <div><h3>Captación en esta sucursal</h3><p>Comparte este enlace o QR para que los clientes se registren en la ubicación correcta.</p></div>
                  {selectedBranch.status !== "ACTIVE" ? <p className="enterprise-alert is-warning" role="status">La sucursal está inactiva. El enlace se conserva, pero no acepta registros hasta reactivarla.</p> : registrationUrl && qrDataUrl ? <PublicRegistrationShare branchName={selectedBranch.name} qrDataUrl={qrDataUrl} registrationUrl={registrationUrl} /> : <p className="enterprise-alert is-error" role="alert">Configura SWIFTWALLET_PUBLIC_URL con el dominio HTTPS de la aplicación para generar el enlace.</p>}
                </div>
              ) : null}
              {activeSection === "access" && !readOnlySupport ? (
                <div className="branch-workspace-section">
                  <div><h3>Entrada de usuarios operativos</h3><p>Elige credenciales personales o una cuenta común con PIN individual. Cambiar el modo revoca las sesiones incompatibles.</p></div>
                  <BranchAccessForm branchId={selectedBranch.id} defaultMode={selectedBranch.employee_access_mode} />
                </div>
              ) : null}
            </div>
          </div>
        ) : params.branch ? (
          <div className="enterprise-empty-state is-error branch-workspace-empty" role="alert"><span className="enterprise-empty-icon" aria-hidden="true">!</span><h2 id="branch-workspace-title">Sucursal no disponible</h2><p>La sucursal no existe o ya no pertenece a tu negocio.</p><Link className="enterprise-secondary-action" href="/admin/branches">Volver al inventario</Link></div>
          ) : null}
        </BranchWorkspaceDialog>
      ) : null}
    </AdminWorkspace>
  );
}
