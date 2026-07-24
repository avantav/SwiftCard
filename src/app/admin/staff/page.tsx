import { requireInternalArea } from "@/lib/auth/server";
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
    <main className="shell">
      <section className="panel" aria-labelledby="staff-title">
        <p className="eyebrow">Administrador</p>
        <h1 id="staff-title" className="form-title">
          Personal del tenant
        </h1>
        {created ? <p className="success-alert" role="status">Personal creado.</p> : null}
        {assigned ? <p className="success-alert" role="status">Sucursal asignada.</p> : null}
        {error ? <p className="auth-alert" role="alert">{error}</p> : null}
        {staffError ? (
          <p className="auth-alert" role="alert">No se pudo cargar el personal.</p>
        ) : null}
        <div className="management-grid">
          <div>
            <h2 className="section-title">Personal actual</h2>
            <div className="data-list">
              {staff?.length ? staff.map((member) => {
                const memberAssignments = assignments?.filter(
                  (assignment) => assignment.staff_profile_id === member.id
                ) ?? [];
                return (
                <div key={member.id} className="staff-row">
                  <strong>{member.full_name}</strong>
                  <span>{member.email}</span>
                  <span>{member.role} · {member.status}</span>
                  <span>
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
                    <button className="secondary-button" type="submit">Asignar</button>
                  </form>
                </div>
                );
              }) : <p className="empty-state">No hay personal registrado.</p>}
            </div>
          </div>
          <div>
            <h2 className="section-title">Nuevo personal</h2>
            <form className="auth-form" action={createStaff}>
              <label className="field"><span>Nombre completo</span><input name="fullName" required /></label>
              <label className="field"><span>Correo</span><input name="email" type="email" required /></label>
              <label className="field"><span>Rol</span><select name="role" defaultValue="EMPLOYEE"><option value="EMPLOYEE">Empleado</option><option value="MANAGER">Encargado</option></select></label>
              <label className="field"><span>Contraseña temporal</span><input name="temporaryPassword" type="password" minLength={12} maxLength={72} required /></label>
              <label className="field"><span>Confirmar contraseña</span><input name="passwordConfirmation" type="password" minLength={12} maxLength={72} required /></label>
              <button className="primary-button" type="submit">Crear personal</button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
