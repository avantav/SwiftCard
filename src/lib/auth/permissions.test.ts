import { describe, expect, it } from "vitest";
import {
  canAccessAdminPanel,
  canAccessBranch,
  canAccessEmployeePwa,
  canAccessSuperadminPanel,
  canCreateTenant,
  canManageBranches,
  canManageStaff,
  canOperateBranch,
  canResetTenantAdminPasswords,
  canViewAudit,
  mustChangePassword,
  type StaffAccessContext
} from "./permissions";

const activeSuperadmin: StaffAccessContext = {
  role: "SUPERADMIN",
  staffStatus: "ACTIVE"
};

const activeAdmin: StaffAccessContext = {
  role: "ADMIN",
  staffStatus: "ACTIVE",
  tenantStatus: "ACTIVE"
};

const activeManager: StaffAccessContext = {
  role: "MANAGER",
  staffStatus: "ACTIVE",
  tenantStatus: "ACTIVE",
  assignedBranchIds: ["branch-a"]
};

const activeEmployee: StaffAccessContext = {
  role: "EMPLOYEE",
  staffStatus: "ACTIVE",
  tenantStatus: "ACTIVE",
  assignedBranchIds: ["branch-a"]
};

describe("role permission helpers", () => {
  it("allows superadmin-only tenant operations", () => {
    expect(canAccessSuperadminPanel(activeSuperadmin)).toBe(true);
    expect(canCreateTenant(activeSuperadmin)).toBe(true);
    expect(canResetTenantAdminPasswords(activeSuperadmin)).toBe(true);

    expect(canAccessSuperadminPanel(activeAdmin)).toBe(false);
    expect(canCreateTenant(activeAdmin)).toBe(false);
    expect(canResetTenantAdminPasswords(activeAdmin)).toBe(false);
  });

  it("allows admins to manage tenant configuration and staff", () => {
    expect(canAccessAdminPanel(activeAdmin)).toBe(true);
    expect(canManageBranches(activeAdmin)).toBe(true);
    expect(canManageStaff(activeAdmin)).toBe(true);
    expect(canAccessBranch(activeAdmin, "any-tenant-branch")).toBe(true);

    expect(canManageBranches(activeManager)).toBe(false);
    expect(canManageStaff(activeManager)).toBe(false);
  });

  it("allows managers and employees to use only assigned PWA branches", () => {
    expect(canAccessEmployeePwa(activeManager)).toBe(true);
    expect(canAccessEmployeePwa(activeEmployee)).toBe(true);
    expect(canOperateBranch(activeManager, "branch-a")).toBe(true);
    expect(canOperateBranch(activeEmployee, "branch-a")).toBe(true);

    expect(canOperateBranch(activeManager, "branch-b")).toBe(false);
    expect(canOperateBranch(activeEmployee, "branch-b")).toBe(false);
    expect(canAccessEmployeePwa(activeAdmin)).toBe(false);
  });

  it("blocks suspended tenants and inactive users from normal operations", () => {
    const suspendedAdmin: StaffAccessContext = {
      ...activeAdmin,
      tenantStatus: "SUSPENDED"
    };
    const inactiveManager: StaffAccessContext = {
      ...activeManager,
      staffStatus: "INACTIVE"
    };

    expect(canAccessAdminPanel(suspendedAdmin)).toBe(false);
    expect(canManageBranches(suspendedAdmin)).toBe(false);
    expect(canAccessEmployeePwa(inactiveManager)).toBe(false);
    expect(canOperateBranch(inactiveManager, "branch-a")).toBe(false);
    expect(canViewAudit(suspendedAdmin)).toBe(false);
  });

  it("keeps password reset sessions out of operational permissions", () => {
    const resetRequiredEmployee: StaffAccessContext = {
      ...activeEmployee,
      staffStatus: "PASSWORD_RESET_REQUIRED"
    };

    expect(mustChangePassword(resetRequiredEmployee)).toBe(true);
    expect(canAccessEmployeePwa(resetRequiredEmployee)).toBe(false);
    expect(canOperateBranch(resetRequiredEmployee, "branch-a")).toBe(false);
  });

  it("limits audit visibility to superadmin, admin, and manager scopes", () => {
    expect(canViewAudit(activeSuperadmin)).toBe(true);
    expect(canViewAudit(activeAdmin)).toBe(true);
    expect(canViewAudit(activeManager)).toBe(true);
    expect(canViewAudit(activeEmployee)).toBe(false);
  });
});

