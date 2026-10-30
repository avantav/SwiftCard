import Link from "next/link";
import { BranchWorkspaceDialog } from "@/components/branch-workspace-dialog";
import { PendingLinkContent } from "@/components/pending-link-content";
import { StaffCreateWizard } from "@/components/staff-create-wizard";
import { SubmitButton } from "@/components/submit-button";
import { requireInternalArea } from "@/lib/auth/server";
import { resetEmployeePassword, setEmployeeStatus } from "./actions";
import { assignStaffBranch } from "./assignments";
import { clearPinLockout, resetPinOperator, setPinOperatorStatus } from "./pin-actions";

type StaffPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

type PinOperator = {
  id: string;
  full_name: string;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
};

function staffHref(branchId: string, params: Record<string, string>) {
  return `/admin/staff?${new URLSearchParams({ branch: branchId, ...params })}`;
}

function initials(name: string) {
  return name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const context = await requireInternalArea("ADMIN");
  const params = await searchParams;
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
    context.supabase.from("branches").select("id,name,status,employee_access_mode").eq("status", "ACTIVE").order("name"),
    context.supabase.from("staff_branch_assignments").select("staff_profile_id,branch_id,is_primary").eq("tenant_id", context.tenantId),
  ]);

  const staff = staffResult.data ?? [];
  const branches = branchesResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const selectedBranch = branches.find((branch) => branch.id === params.branch) ?? branches[0] ?? null;
  const selectedAssignments = selectedBranch ? assignments.filter((assignment) => assignment.branch_id === selectedBranch.id) : [];
  const branchStaff = staff.filter((member) => selectedAssignments.some((assignment) => assignment.staff_profile_id === member.id));
  const pinEnabled = selectedBranch?.employee_access_mode === "SHARED_ACCOUNT_PIN";
  const pinResult = selectedBranch && pinEnabled
    ? await context.supabase.schema("app").rpc("list_branch_pin_operators", { target_branch_id: selectedBranch.id })
    : { data: [], error: null };
  const pinOperators = (pinResult.data ?? []) as PinOperator[];
  const selectedMember = branchStaff.find((member) => member.id === params.staff) ?? null;
  const selectedPin = pinOperators.find((operator) => operator.id === params.pin) ?? null;
  const showCreate = params.view === "create" && selectedBranch;
  const createType = params.type === "individual" || !pinEnabled ? "individual" : "pin";
  const success = params.created || params.assigned || params.pinCreated || params.pinUpdated || params.staffUpdated || params.passwordReset || params.lockCleared;
  const individualBranches = branches.filter((branch) => branch.employee_access_mode === "INDIVIDUAL_CREDENTIALS");

  return <main className="enterprise-page staff-control-page">
    <header className="enterprise-page-header staff-compact-header">
      <div><p className="enterprise-breadcrumb">Configuración</p><h1 id="staff-title">Personal</h1><p>Selecciona una sucursal para administrar a las personas que operan ahí.</p></div>
      {selectedBranch ? <Link className="enterprise-primary-action" href={staffHref(selectedBranch.id, { view: "create", type: pinEnabled ? "pin" : "individual" })}><PendingLinkContent label="Abriendo alta">{pinEnabled ? "Agregar usuario PIN" : "Agregar personal"}</PendingLinkContent></Link> : null}
    </header>

    {success ? <p className="enterprise-alert is-success" role="status">La configuración de personal se actualizó correctamente.</p> : null}
    {params.error ? <p className="enterprise-alert is-error" role="alert">{params.error}</p> : null}

    {branchesResult.error ? <section className="enterprise-empty-state is-error" role="alert"><h2>No se pudieron cargar las sucursales</h2><p>Actualiza la página para volver a intentarlo.</p></section> : branches.length ? <>
      <nav className="staff-branch-nav" aria-label="Sucursales">
        {branches.map((branch) => <Link aria-current={selectedBranch?.id === branch.id ? "page" : undefined} className={selectedBranch?.id === branch.id ? "is-active" : undefined} href={`/admin/staff?branch=${encodeURIComponent(branch.id)}`} key={branch.id}><PendingLinkContent label={`Cargando ${branch.name}`}>{branch.name}</PendingLinkContent></Link>)}
      </nav>

      <section className="enterprise-data-panel staff-inventory-panel" aria-labelledby="staff-list-title">
        <div className="enterprise-panel-header staff-inventory-heading">
          <div><h2 id="staff-list-title">{selectedBranch?.name}</h2><p>{branchStaff.length + pinOperators.length} {(branchStaff.length + pinOperators.length) === 1 ? "persona" : "personas"}</p></div>
          <span className={`enterprise-badge ${pinEnabled ? "is-neutral" : "is-active"}`}>{pinEnabled ? "Cuenta compartida + PIN" : "Cuentas individuales"}</span>
        </div>
        {staffResult.error || assignmentsResult.error || pinResult.error ? <div className="enterprise-empty-state is-error admin-compact-empty" role="alert"><h3>No se pudo cargar el personal</h3><p>Actualiza la página para volver a intentarlo.</p></div> : branchStaff.length || pinOperators.length ? <div className="enterprise-table-wrap staff-inventory-scroll"><table className="enterprise-table staff-inventory-table"><caption className="sr-only">Personal asignado a {selectedBranch?.name}</caption><thead><tr><th>Persona</th><th>Rol</th><th>Acceso</th><th>Estado</th><th>Asignación</th><th><span className="sr-only">Acción</span></th></tr></thead><tbody>
          {branchStaff.map((member) => {
            const assignment = selectedAssignments.find((item) => item.staff_profile_id === member.id);
            return <tr key={member.id}><td data-label="Persona"><div className="staff-person-cell"><span className="enterprise-user-avatar" aria-hidden="true">{initials(String(member.full_name))}</span><span><strong>{member.full_name}</strong><small>{member.email}</small></span></div></td><td data-label="Rol">{member.role === "MANAGER" ? "Administrador de sucursal" : "Empleado"}</td><td data-label="Acceso">Cuenta individual</td><td data-label="Estado"><span className={`enterprise-badge ${member.status === "ACTIVE" ? "is-active" : "is-neutral"}`}>{member.status === "ACTIVE" ? "Activo" : member.status === "PASSWORD_RESET_REQUIRED" ? "Contraseña pendiente" : "Inactivo"}</span></td><td data-label="Asignación">{assignment?.is_primary ? <span className="enterprise-badge is-active">Principal</span> : "Secundaria"}</td><td className="enterprise-row-actions"><Link className="enterprise-secondary-action" href={staffHref(selectedBranch!.id, { staff: member.id, section: "summary" })}><PendingLinkContent label={`Abriendo ${member.full_name}`}>Administrar</PendingLinkContent></Link></td></tr>;
          })}
          {pinOperators.map((operator) => <tr key={operator.id}><td data-label="Persona"><div className="staff-person-cell"><span className="enterprise-user-avatar" aria-hidden="true">{initials(operator.full_name)}</span><span><strong>{operator.full_name}</strong><small>Sin correo personal</small></span></div></td><td data-label="Rol">Operador</td><td data-label="Acceso">PIN personal</td><td data-label="Estado"><span className={`enterprise-badge ${operator.status === "ACTIVE" ? "is-active" : "is-neutral"}`}>{operator.status === "ACTIVE" ? "Activo" : "Inactivo"}</span></td><td data-label="Asignación"><span className="enterprise-badge is-neutral">Exclusiva</span></td><td className="enterprise-row-actions"><Link className="enterprise-secondary-action" href={staffHref(selectedBranch!.id, { pin: operator.id, section: "summary" })}><PendingLinkContent label={`Abriendo ${operator.full_name}`}>Administrar</PendingLinkContent></Link></td></tr>)}
        </tbody></table></div> : <div className="enterprise-empty-state admin-compact-empty"><h3>Esta sucursal todavía no tiene personal</h3><p>Agrega la primera persona con el método de acceso configurado.</p><Link className="enterprise-primary-action" href={staffHref(selectedBranch!.id, { view: "create", type: pinEnabled ? "pin" : "individual" })}><PendingLinkContent>Agregar personal</PendingLinkContent></Link></div>}
      </section>
    </> : <section className="enterprise-empty-state"><h2>Primero crea una sucursal</h2><p>El personal siempre se administra dentro del contexto de una ubicación.</p><Link className="enterprise-primary-action" href="/admin/branches?view=create"><PendingLinkContent>Crear sucursal</PendingLinkContent></Link></section>}

    {showCreate || selectedMember || selectedPin ? <BranchWorkspaceDialog closeHref={`/admin/staff?branch=${selectedBranch?.id}`} labelledBy="staff-workspace-title">
      {showCreate ? <div className="enterprise-content-card staff-workspace-card"><div className="branch-workspace-heading"><div><p className="enterprise-breadcrumb">{selectedBranch.name}</p><h2 id="staff-workspace-title">Agregar personal</h2><p>{createType === "pin" ? "Crea una identidad operativa para la cuenta compartida de esta sucursal." : "Crea una cuenta personal y asigna su ubicación inicial."}</p></div><Link className="enterprise-secondary-action" href={`/admin/staff?branch=${selectedBranch.id}`}>Cancelar</Link></div>
        {pinEnabled && context.access.role === "ADMIN" ? <nav className="branch-workspace-nav" aria-label="Tipo de acceso"><Link className={createType === "pin" ? "is-active" : undefined} href={staffHref(selectedBranch.id, { view: "create", type: "pin" })}><PendingLinkContent>Usuario PIN</PendingLinkContent></Link><Link className={createType === "individual" ? "is-active" : undefined} href={staffHref(selectedBranch.id, { view: "create", type: "individual" })}><PendingLinkContent>Cuenta administrativa</PendingLinkContent></Link></nav> : null}
        <div className="branch-workspace-body"><StaffCreateWizard branchId={selectedBranch.id} branches={branches} canCreateBranchAdmin={context.access.role === "ADMIN"} mode={createType} /></div>
      </div> : selectedMember ? <div className="enterprise-data-panel branch-workspace-panel staff-workspace-panel"><div className="branch-workspace-heading"><div><p className="enterprise-breadcrumb">{selectedBranch?.name}</p><h2 id="staff-workspace-title">{selectedMember.full_name}</h2><p>{selectedMember.email}</p></div><Link className="enterprise-secondary-action" href={`/admin/staff?branch=${selectedBranch?.id}`}>Cerrar</Link></div><nav className="branch-workspace-nav"><Link className={params.section !== "branches" && params.section !== "security" ? "is-active" : undefined} href={staffHref(selectedBranch!.id, { staff: selectedMember.id, section: "summary" })}><PendingLinkContent>Resumen</PendingLinkContent></Link><Link className={params.section === "branches" ? "is-active" : undefined} href={staffHref(selectedBranch!.id, { staff: selectedMember.id, section: "branches" })}><PendingLinkContent>Sucursales</PendingLinkContent></Link>{selectedMember.role === "EMPLOYEE" ? <Link className={params.section === "security" ? "is-active" : undefined} href={staffHref(selectedBranch!.id, { staff: selectedMember.id, section: "security" })}><PendingLinkContent>Seguridad</PendingLinkContent></Link> : null}</nav><div className="branch-workspace-body">
        {params.section === "branches" ? <div className="branch-workspace-section"><div><h3>Alcance operativo</h3><p>Agrega otra sucursal y decide si será la ubicación principal.</p></div><div className="staff-assignment-list">{assignments.filter((item) => item.staff_profile_id === selectedMember.id).map((item) => <span key={item.branch_id}><strong>{branches.find((branch) => branch.id === item.branch_id)?.name ?? "Sucursal"}</strong>{item.is_primary ? <span className="enterprise-badge is-active">Principal</span> : null}</span>)}</div><form className="auth-form inline-assignment-form" action={assignStaffBranch}><input type="hidden" name="staffProfileId" value={selectedMember.id} /><label className="field"><span>Agregar sucursal</span><select name="branchId" required defaultValue=""><option value="">Selecciona</option>{(context.access.role === "ADMIN" ? branches : individualBranches).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="check-field"><input name="makePrimary" type="checkbox" /><span>Hacer principal</span></label><SubmitButton className="secondary-button">Asignar</SubmitButton></form></div> : params.section === "security" && selectedMember.role === "EMPLOYEE" ? <div className="branch-workspace-section"><div><h3>Acceso y seguridad</h3><p>Restablece la contraseña o cambia el estado de la cuenta.</p></div><form action={setEmployeeStatus}><input type="hidden" name="staffProfileId" value={selectedMember.id} /><input type="hidden" name="returnBranch" value={selectedBranch?.id} /><input type="hidden" name="status" value={selectedMember.status === "INACTIVE" ? "ACTIVE" : "INACTIVE"} /><SubmitButton className="secondary-button" confirmMessage="Esta acción cambiará inmediatamente el acceso de la persona. ¿Deseas continuar?">{selectedMember.status === "INACTIVE" ? "Activar cuenta" : "Desactivar cuenta"}</SubmitButton></form><form className="auth-form" action={resetEmployeePassword}><input type="hidden" name="staffProfileId" value={selectedMember.id} /><input type="hidden" name="returnBranch" value={selectedBranch?.id} /><label className="field"><span>Contraseña temporal</span><input name="temporaryPassword" type="password" minLength={12} maxLength={72} required /></label><label className="field"><span>Confirmar contraseña</span><input name="passwordConfirmation" type="password" minLength={12} maxLength={72} required /></label><SubmitButton className="secondary-button">Restablecer contraseña</SubmitButton></form></div> : <div className="branch-workspace-section"><div><h3>Resumen de acceso</h3><p>Consulta cómo entra esta persona y dónde opera.</p></div><dl className="staff-summary-list"><div><dt>Rol</dt><dd>{selectedMember.role === "MANAGER" ? "Administrador de sucursal" : "Empleado"}</dd></div><div><dt>Estado</dt><dd>{selectedMember.status === "ACTIVE" ? "Activo" : selectedMember.status === "PASSWORD_RESET_REQUIRED" ? "Cambio de contraseña pendiente" : "Inactivo"}</dd></div><div><dt>Método</dt><dd>Correo y contraseña</dd></div><div><dt>Sucursales</dt><dd>{assignments.filter((item) => item.staff_profile_id === selectedMember.id).length}</dd></div></dl></div>}
      </div></div> : selectedPin ? <div className="enterprise-data-panel branch-workspace-panel staff-workspace-panel"><div className="branch-workspace-heading"><div><p className="enterprise-breadcrumb">{selectedBranch?.name}</p><h2 id="staff-workspace-title">{selectedPin.full_name}</h2><p>Usuario operativo con PIN personal.</p></div><Link className="enterprise-secondary-action" href={`/admin/staff?branch=${selectedBranch?.id}`}>Cerrar</Link></div><nav className="branch-workspace-nav"><Link className={params.section !== "security" ? "is-active" : undefined} href={staffHref(selectedBranch!.id, { pin: selectedPin.id, section: "summary" })}><PendingLinkContent>Resumen</PendingLinkContent></Link><Link className={params.section === "security" ? "is-active" : undefined} href={staffHref(selectedBranch!.id, { pin: selectedPin.id, section: "security" })}><PendingLinkContent>Seguridad</PendingLinkContent></Link></nav><div className="branch-workspace-body">{params.section === "security" ? <div className="branch-workspace-section"><div><h3>PIN y estado</h3><p>El PIN actual nunca se muestra ni se puede recuperar.</p></div><form action={setPinOperatorStatus}><input type="hidden" name="operatorId" value={selectedPin.id} /><input type="hidden" name="returnBranch" value={selectedBranch?.id} /><input type="hidden" name="status" value={selectedPin.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} /><SubmitButton className="secondary-button">{selectedPin.status === "ACTIVE" ? "Desactivar usuario" : "Activar usuario"}</SubmitButton></form><form className="auth-form" action={resetPinOperator}><input type="hidden" name="operatorId" value={selectedPin.id} /><input type="hidden" name="returnBranch" value={selectedBranch?.id} /><label className="field"><span>PIN nuevo</span><input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required /></label><SubmitButton className="secondary-button">Restablecer PIN</SubmitButton></form><form action={clearPinLockout}><input type="hidden" name="branchId" value={selectedBranch?.id} /><SubmitButton className="secondary-button">Desbloquear intentos</SubmitButton></form></div> : <div className="branch-workspace-section"><div><h3>Resumen de acceso</h3><p>Este usuario solo puede operar mediante la cuenta compartida de esta sucursal.</p></div><dl className="staff-summary-list"><div><dt>Rol</dt><dd>Operador</dd></div><div><dt>Estado</dt><dd>{selectedPin.status === "ACTIVE" ? "Activo" : "Inactivo"}</dd></div><div><dt>Método</dt><dd>PIN personal</dd></div><div><dt>Asignación</dt><dd>{selectedBranch?.name}</dd></div></dl></div>}</div></div> : null}
    </BranchWorkspaceDialog> : null}
  </main>;
}
