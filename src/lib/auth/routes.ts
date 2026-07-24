import type { StaffAccessContext, StaffRole } from "./permissions";
import {
  canAccessAdminPanel,
  canAccessEmployeePwa,
  canAccessSuperadminPanel
} from "./permissions";

export type InternalArea = "SUPERADMIN" | "ADMIN" | "APP";

export function getDefaultInternalRoute(role: StaffRole) {
  switch (role) {
    case "SUPERADMIN":
      return "/superadmin";
    case "ADMIN":
    case "MANAGER":
      return "/admin";
    case "EMPLOYEE":
      return "/app";
  }
}

export function canAccessInternalArea(
  context: StaffAccessContext,
  area: InternalArea
) {
  switch (area) {
    case "SUPERADMIN":
      return canAccessSuperadminPanel(context);
    case "ADMIN":
      return canAccessAdminPanel(context);
    case "APP":
      return canAccessEmployeePwa(context);
  }
}
