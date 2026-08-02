import { requireInternalArea } from "@/lib/auth/server";
import { SubmitButton } from "@/components/submit-button";
import { createStaff } from "./actions";
import { assignStaffBranch } from "./assignments";

type StaffPageProps = {
  searchParams: Promise<{ assigned?: string; created?: string; error?: string }>;
};

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const context = await requireInternalArea("ADMIN");
  const { assigned, created, error } = await searchParams;

  if (context.access.role !== "ADMIN" || !context.tenantId) {
    return null;
  }

  const { data: staff, error: staffError } = await context.supabase
    .from("staff_profiles")
    .select("id,full_name,email,role,status")
    .eq("tenant_id", context.tenantId)
    .in("role", ["MANAGER", "EMPLOYEE"])
    .order("full_name");
  const { data: branches } = await context.supabase
    .from("branches")
    .select("id,name,status")
    .eq("tenant_id", context.tenantId)
    .order("name");
  const { data: assignments } = await context.supabase
    .from("staff_branch_assignments")
    .select("staff_profile_id,branch_id,is_primary")
    .eq("tenant_id", context.tenantId);

  return (
    <main className="enterprise-page">
      <header className="enterprise-page-header"><div><p className="enterprise-breadcrumb">Configuración</p><h1 id="staff-title">Personal</h1><p>Gestiona cuentas, roles y sucursales asignadas.</p></div><a className="enterprise-primary-action" href="#new-staff">Crear cuenta</a></header>
        {created ? <p className="enterprise-alert is-success" role="status">Personal creado.</p> : null}
        {assigned ? <p className="enterprise-alert is-success" role="status">Sucursal asignada.</p> : null}
        {error ? <p className="enterprise-alert is-error" role="alert">{error}</p> : null}
        <div className="admin-management-grid">
          <section className="enterprise-data-panel" aria-labelledby="staff-list-title">
            <div className="enterprise-panel-header"><div><h2 id="staff-list-title">Personal actual</h2><p>{staff?.length ?? 0} {(staff?.length ?? 0) === 1 ? "cuenta" : "cuentas"}</p></div></div>
            <div className="admin-record-list">
              {staffError ? <div className="enterprise-empty-state is-error admin-compact-empty" role="alert"><span className="enterprise-empty-icon" aria-hidden="true">!</span><h3>No se pudo cargar el personal</h3><p>Actualiza la página para volver a intentarlo.</p></div> : staff?.length ? staff.map((member) => {
                const memberAssignments = assignments?.filter(
                  (assignment) => assignment.staff_profile_id === member.id
                ) ?? [];
                return (
                <article key={member.id} className="admin-record admin-staff-record">
                  <div className="admin-staff-heading"><span className="enterprise-user-avatar" aria-hidden="true">{String(member.full_name).split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{member.full_name}</strong><small>{member.email}</small></span></div>
                  <div className="admin-record-meta"><span className={`enterprise-badge ${member.status === "ACTIVE" ? "is-active" : "is-neutral"}`}>{member.status === "ACTIVE" ? "Activo" : "Inactivo"}</span><span>{member.role === "MANAGER" ? "Encargado" : "Empleado"}</span></div>
                  <span className="admin-assignment-copy">
                    Sucursales: {memberAssignments.map((assignment) => {
                      const branch = branches?.find((item) => item.id === assignment.branch_id);
                      return `${branch?.name ?? "Desconocida"}${assignment.is_primary ? " (principal)" : ""}`;
                    }).join(", ") || "Sin asignar"}
                  </span>
                  <form className="inline-assignment-form" action={assignStaffBranch}>
                    <input type="hidden" name="staffProfileId" value={member.id} />
                    <label className="field">
                      <span>Asignar sucursal</span>
                      <select name="branchId" required>
                        <option value="">Selecciona</option>
                        {branches?.filter((branch) => branch.status === "ACTIVE").map((branch) => (
                          <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="check-field">
                      <input name="makePrimary" type="checkbox" />
                      <span>Hacer principal</span>
                    </label>
                    <SubmitButton className="secondary-button">Asignar sucursal</SubmitButton>
                  </form>
                </article>
                );
              }) : <div className="enterprise-empty-state admin-compact-empty"><span className="enterprise-empty-icon" aria-hidden="true">+</span><h3>Crea la primera cuenta</h3><p>Agrega un Encargado o Empleado y asígnalo a una sucursal.</p></div>}
            </div>
          </section>
          <section className="enterprise-content-card admin-form-card" id="new-staff" aria-labelledby="new-staff-title">
            <h2 id="new-staff-title" className="admin-card-title">Nuevo personal</h2>
            <p className="admin-card-copy">La persona deberá cambiar su contraseña temporal al ingresar.</p>
            <form className="auth-form" action={createStaff}>
              <label className="field"><span>Nombre completo</span><input name="fullName" required /></label>
              <label className="field"><span>Correo</span><input name="email" type="email" required /></label>
              <label className="field"><span>Rol</span><select name="role" defaultValue="EMPLOYEE"><option value="EMPLOYEE">Empleado</option><option value="MANAGER">Encargado</option></select></label>
              <label className="field"><span>Contraseña temporal</span><input name="temporaryPassword" type="password" minLength={12} maxLength={72} required /></label>
              <label className="field"><span>Confirmar contraseña</span><input name="passwordConfirmation" type="password" minLength={12} maxLength={72} required /></label>
              <SubmitButton>Crear personal</SubmitButton>
            </form>
          </section>
        </div>
    </main>
  );
}
