import { describe, expect, it } from "vitest";
import { canAccessInternalArea, getDefaultInternalRoute } from "./routes";

describe("internal auth routes", () => {
  it("maps each role to its default route", () => {
    expect(getDefaultInternalRoute("SUPERADMIN")).toBe("/superadmin");
    expect(getDefaultInternalRoute("ADMIN")).toBe("/admin");
    expect(getDefaultInternalRoute("MANAGER")).toBe("/admin");
    expect(getDefaultInternalRoute("EMPLOYEE")).toBe("/app");
  });

  it("applies role and status rules to each internal area", () => {
    expect(
      canAccessInternalArea(
        { role: "SUPERADMIN", staffStatus: "ACTIVE" },
        "SUPERADMIN"
      )
    ).toBe(true);
    expect(
      canAccessInternalArea(
        {
          role: "ADMIN",
          staffStatus: "ACTIVE",
          tenantStatus: "ACTIVE"
        },
        "ADMIN"
      )
    ).toBe(true);
    expect(
      canAccessInternalArea(
        {
          role: "EMPLOYEE",
          staffStatus: "ACTIVE",
          tenantStatus: "ACTIVE"
        },
        "APP"
      )
    ).toBe(true);
  });

  it("denies reset-required, inactive, and suspended contexts", () => {
    expect(
      canAccessInternalArea(
        {
          role: "ADMIN",
          staffStatus: "PASSWORD_RESET_REQUIRED",
          tenantStatus: "ACTIVE"
        },
        "ADMIN"
      )
    ).toBe(false);
    expect(
      canAccessInternalArea(
        {
          role: "EMPLOYEE",
          staffStatus: "INACTIVE",
          tenantStatus: "ACTIVE"
        },
        "APP"
      )
    ).toBe(false);
    expect(
      canAccessInternalArea(
        {
          role: "MANAGER",
          staffStatus: "ACTIVE",
          tenantStatus: "SUSPENDED"
        },
        "ADMIN"
      )
    ).toBe(false);
  });
});
