export const STAFF_ROLES = ["SUPERADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] as const;
export const STAFF_STATUSES = ["ACTIVE", "INACTIVE", "PASSWORD_RESET_REQUIRED"] as const;
export const TENANT_STATUSES = ["ACTIVE", "SUSPENDED"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type StaffStatus = (typeof STAFF_STATUSES)[number];
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export type StaffAccessContext = {
  role: StaffRole;
  staffStatus: StaffStatus;
  tenantStatus?: TenantStatus | null;
  assignedBranchIds?: readonly string[];
};

export function isActiveStaff(context: StaffAccessContext) {
  return context.staffStatus === "ACTIVE";
}

export function isActiveTenantStaff(context: StaffAccessContext) {
  if (context.role === "SUPERADMIN") {
    return isActiveStaff(context);
  }

  return isActiveStaff(context) && context.tenantStatus === "ACTIVE";
}

export function mustChangePassword(context: StaffAccessContext) {
  return context.staffStatus === "PASSWORD_RESET_REQUIRED";
}

export function canAccessSuperadminPanel(context: StaffAccessContext) {
  return context.role === "SUPERADMIN" && isActiveStaff(context);
}

export function canCreateTenant(context: StaffAccessContext) {
  return canAccessSuperadminPanel(context);
}

export function canAccessAdminPanel(context: StaffAccessContext) {
  return (
    isActiveTenantStaff(context) &&
    (context.role === "ADMIN" || context.role === "MANAGER")
  );
}

export function canManageBranches(context: StaffAccessContext) {
  return isActiveTenantStaff(context) && context.role === "ADMIN";
}

export function canManageStaff(context: StaffAccessContext) {
  return isActiveTenantStaff(context) && context.role === "ADMIN";
}

export function canResetTenantAdminPasswords(context: StaffAccessContext) {
  return canAccessSuperadminPanel(context);
}

export function canAccessEmployeePwa(context: StaffAccessContext) {
  return (
    isActiveTenantStaff(context) &&
    (context.role === "MANAGER" || context.role === "EMPLOYEE")
  );
}

export function canAccessBranch(
  context: StaffAccessContext,
  branchId: string
) {
  if (!isActiveTenantStaff(context)) {
    return false;
  }

  if (context.role === "SUPERADMIN" || context.role === "ADMIN") {
    return true;
  }

  return context.assignedBranchIds?.includes(branchId) ?? false;
}

export function canOperateBranch(
  context: StaffAccessContext,
  branchId: string
) {
  if (!canAccessEmployeePwa(context)) {
    return false;
  }

  return context.assignedBranchIds?.includes(branchId) ?? false;
}

export function canViewAudit(context: StaffAccessContext) {
  return (
    canAccessSuperadminPanel(context) ||
    (isActiveTenantStaff(context) &&
      (context.role === "ADMIN" || context.role === "MANAGER"))
  );
}

