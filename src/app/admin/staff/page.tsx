import { SubmitButton } from "@/components/submit-button";
import { StaffRoleBranchFields } from "@/components/staff-role-branch-fields";
import { requireInternalArea } from "@/lib/auth/server";
import {
  createStaff,
  resetEmployeePassword,
  setEmployeeStatus
} from "./actions";
import { assignStaffBranch } from "./assignments";
import {
  clearPinLockout,
  createPinOperator,
  resetPinOperator,
  setPinOperatorStatus
} from "./pin-actions";

type StaffPageProps = {
  searchParams: Promise<{
    assigned?: string;
    created?: string;
    error?: string;
    lockCleared?: string;
    passwordReset?: string;
    pinCreated?: string;
    pinUpdated?: string;
    staffUpdated?: string;
  }>;
};

type PinOperator = {
  id: string;
  full_name: string;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
};

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const context = await requireInternalArea("ADMIN");
  const messages = await searchParams;
  if (!context.tenantId) return null;

  let staffQuery = context.supabase
    .from("staff_profiles")
    .select("id,full_name,email,role,status,account_kind")
    .eq("tenant_id", context.tenantId)
    .eq("account_kind", "INDIVIDUAL")
    .in("role", ["MANAGER", "EMPLOYEE"])
    .order("full_name");
  if (context.access.role === "MANAGER") staffQuery = staffQuery.eq("role", "EMPLOYEE");

  const [staffResult, branchesResult, assignmentsResult] = await Promise.all([
    staffQuery,
    context.supabase
      .from("branches")
      .select("id,name,status,employee_access_mode")
      .eq("status", "ACTIVE")
      .order("name"),
    context.supabase
      .from("staff_branch_assignments")
      .select("staff_profile_id,branch_id,is_primary")
      .eq("tenant_id", context.tenantId)
  ]);

  const staff = staffResult.data ?? [];
  const branches = branchesResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const pinBranches = branches.filter((branch) => branch.employee_access_mode === "SHARED_ACCOUNT_PIN");
  const pinGroups = await Promise.all(pinBranches.map(async (branch) => {
    const { data, error } = await context.supabase.schema("app").rpc("list_branch_pin_operators", {
      target_branch_id: branch.id
    });
    return { branch, error, operators: (data ?? []) as PinOperator[] };
  }));
  const individualBranches = branches.filter((branch) => branch.employee_access_mode === "INDIVIDUAL_CREDENTIALS");
  const success = messages.created || messages.assigned || messages.pinCreated || messages.pinUpdated || messages.staffUpdated || messages.passwordReset || messages.lockCleared;

  return <main className="enterprise-page">
    <header className="enterprise-page-header">
      <div><p className="enterprise-breadcrumb">Configuración</p><h1 id="staff-title">Personal</h1><p>Administra cuentas personales y usuarios PIN dentro de tus sucursales.</p></div>
      <a className="enterprise-primary-action" href="#new-staff">Crear cuenta</a>
    </header>
    {success ? <p className="enterprise-alert is-success" role="status">La configuración de personal se actualizó correctamente.</p> : null}
    {messages.error ? <p className="enterprise-alert is-error" role="alert">{messages.error}</p> : null}

    <div className="admin-management-grid">
      <section className="enterprise-data-panel" aria-labelledby="staff-list-title">
        <div className="enterprise-panel-header"><div><h2 id="staff-list-title">Cuentas individuales</h2><p>{staff.length} {staff.length === 1 ? "cuenta" : "cuentas"}</p></div></div>
        <div className="admin-record-list">
          {staffResult.error ? <div className="enterprise-empty-state is-error admin-compact-empty" role="alert"><h3>No se pudo cargar el personal</h3><p>Actualiza la página para volver a intentarlo.</p></div> : staff.length ? staff.map((member) => {
            const memberAssignments = assignments.filter((assignment) => assignment.staff_profile_id === member.id);
            const isEmployee = member.role === "EMPLOYEE";
            return <article key={member.id} className="admin-record admin-staff-record">
              <div className="admin-staff-heading"><span className="enterprise-user-avatar" aria-hidden="true">{String(member.full_name).split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{member.full_name}</strong><small>{member.email}</small></span></div>
              <div className="admin-record-meta"><span className={`enterprise-badge ${member.status === "ACTIVE" ? "is-active" : "is-neutral"}`}>{member.status === "ACTIVE" ? "Activo" : member.status === "PASSWORD_RESET_REQUIRED" ? "Cambio de contraseña pendiente" : "Inactivo"}</span><span>{member.role === "MANAGER" ? "Administrador de sucursal" : "Empleado"}</span></div>
              <span className="admin-assignment-copy">Sucursales: {memberAssignments.map((assignment) => { const branch = branches.find((item) => item.id === assignment.branch_id); return `${branch?.name ?? "Desconocida"}${assignment.is_primary ? " (principal)" : ""}`; }).join(", ") || "Sin asignar"}</span>
              {context.access.role === "ADMIN" || isEmployee ? <form className="inline-assignment-form" action={assignStaffBranch}><input type="hidden" name="staffProfileId" value={member.id} /><label className="field"><span>Asignar sucursal</span><select name="branchId" required defaultValue=""><option value="">Selecciona</option>{(context.access.role === "ADMIN" ? branches : individualBranches).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="check-field"><input name="makePrimary" type="checkbox" /><span>Hacer principal</span></label><SubmitButton className="secondary-button">Asignar</SubmitButton></form> : null}
              {isEmployee ? <div className="admin-record-actions"><form action={setEmployeeStatus}><input type="hidden" name="staffProfileId" value={member.id} /><input type="hidden" name="status" value={member.status === "INACTIVE" ? "ACTIVE" : "INACTIVE"} /><SubmitButton className="secondary-button">{member.status === "INACTIVE" ? "Activar" : "Desactivar"}</SubmitButton></form><details className="admin-inline-details"><summary>Restablecer contraseña</summary><form className="auth-form admin-inline-form" action={resetEmployeePassword}><input type="hidden" name="staffProfileId" value={member.id} /><label className="field"><span>Contraseña temporal</span><input name="temporaryPassword" type="password" minLength={12} maxLength={72} required /></label><label className="field"><span>Confirmar contraseña</span><input name="passwordConfirmation" type="password" minLength={12} maxLength={72} required /></label><SubmitButton className="secondary-button">Restablecer</SubmitButton></form></details></div> : null}
            </article>;
          }) : <div className="enterprise-empty-state admin-compact-empty"><h3>Sin cuentas individuales</h3><p>Crea un Administrador de sucursal o empleado para una ubicación con acceso individual.</p></div>}
        </div>
      </section>

      <section className="enterprise-content-card admin-form-card" id="new-staff" aria-labelledby="new-staff-title">
        <h2 id="new-staff-title" className="admin-card-title">Nueva cuenta individual</h2>
        <p className="admin-card-copy">La persona deberá cambiar su contraseña temporal al ingresar.</p>
        <form className="auth-form" action={createStaff}>
          <label className="field"><span>Nombre completo</span><input name="fullName" required /></label>
          <label className="field"><span>Correo</span><input name="email" type="email" required /></label>
          <StaffRoleBranchFields branches={branches} canCreateBranchAdmin={context.access.role === "ADMIN"} />
          <label className="field"><span>Contraseña temporal</span><input name="temporaryPassword" type="password" minLength={12} maxLength={72} required /></label>
          <label className="field"><span>Confirmar contraseña</span><input name="passwordConfirmation" type="password" minLength={12} maxLength={72} required /></label>
          <SubmitButton>Crear personal</SubmitButton>
        </form>
      </section>
    </div>

    <section className="enterprise-data-panel" aria-labelledby="pin-users-title">
      <div className="enterprise-panel-header"><div><h2 id="pin-users-title">Usuarios con PIN</h2><p>Operadores sin correo personal en sucursales con cuenta compartida.</p></div></div>
      {branchesResult.error ? <div className="enterprise-empty-state is-error admin-compact-empty" role="alert"><h3>No se pudieron cargar las sucursales</h3></div> : pinGroups.length ? <div className="admin-pin-branches">{pinGroups.map(({ branch, error, operators }) => <article className="admin-pin-branch" key={branch.id}>
        <header><div><h3>{branch.name}</h3><p>{operators.length} {operators.length === 1 ? "usuario PIN" : "usuarios PIN"}</p></div><form action={clearPinLockout}><input type="hidden" name="branchId" value={branch.id} /><SubmitButton className="secondary-button">Desbloquear intentos</SubmitButton></form></header>
        {error ? <p className="enterprise-alert is-error" role="alert">No se pudieron cargar los usuarios.</p> : null}
        <div className="admin-record-list">{operators.map((operator) => <article className="admin-record" key={operator.id}><div><strong>{operator.full_name}</strong><span>Acceso mediante PIN personal</span></div><div className="admin-record-meta"><span className={`enterprise-badge ${operator.status === "ACTIVE" ? "is-active" : "is-neutral"}`}>{operator.status === "ACTIVE" ? "Activo" : "Inactivo"}</span></div><div className="admin-record-actions"><form action={setPinOperatorStatus}><input type="hidden" name="operatorId" value={operator.id} /><input type="hidden" name="status" value={operator.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} /><SubmitButton className="secondary-button">{operator.status === "ACTIVE" ? "Desactivar" : "Activar"}</SubmitButton></form><details className="admin-inline-details"><summary>Restablecer PIN</summary><form className="inline-assignment-form" action={resetPinOperator}><input type="hidden" name="operatorId" value={operator.id} /><label className="field"><span>PIN nuevo</span><input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required /></label><SubmitButton className="secondary-button">Guardar PIN</SubmitButton></form></details></div></article>)}</div>
        <form className="auth-form admin-pin-create" action={createPinOperator}><input type="hidden" name="branchId" value={branch.id} /><h4>Agregar usuario PIN</h4><label className="field"><span>Nombre completo</span><input name="fullName" required /></label><label className="field"><span>PIN de seis dígitos</span><input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required /></label><SubmitButton className="secondary-button">Crear usuario PIN</SubmitButton></form>
      </article>)}</div> : <div className="enterprise-empty-state admin-compact-empty"><h3>No hay sucursales con acceso PIN</h3><p>El Admin general puede habilitarlo desde Sucursales.</p></div>}
    </section>
  </main>;
}
