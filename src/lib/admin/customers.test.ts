import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  adminCustomerPageHref,
  parseAdminCustomerDirectoryParams,
  resolveAdminCustomerSearch,
} from "./customers";

const pageSource = readFileSync(
  join(process.cwd(), "src/app/admin/customers/page.tsx"),
  "utf8",
);
const navigationSource = readFileSync(
  join(process.cwd(), "src/components/admin-navigation.tsx"),
  "utf8",
);

describe("admin customer directory", () => {
  it("normalizes bounded filters and pagination", () => {
    expect(
      parseAdminCustomerDirectoryParams({
        page: "3",
        q: `  ${"A".repeat(100)}  `,
        status: "INACTIVE",
      }),
    ).toEqual({
      page: 3,
      search: "A".repeat(80),
      status: "INACTIVE",
    });
    expect(
      parseAdminCustomerDirectoryParams({ page: "invalid", status: "ADMIN" }),
    ).toEqual({ page: 1, search: "", status: "ALL" });
  });

  it("distinguishes normalized phone searches from name searches", () => {
    expect(resolveAdminCustomerSearch("811 111 1111")).toEqual({
      kind: "PHONE",
      value: "+528111111111",
    });
    expect(resolveAdminCustomerSearch("María López")).toEqual({
      kind: "NAME",
      value: "María López",
    });
  });

  it("preserves active filters in pagination links", () => {
    expect(
      adminCustomerPageHref({
        page: 2,
        search: "María",
        status: "ACTIVE",
      }),
    ).toBe("/admin/customers?q=Mar%C3%ADa&status=ACTIVE&page=2");
  });

  it("keeps the route and navigation exclusive to the tenant admin", () => {
    expect(pageSource).toContain('requireInternalArea("ADMIN")');
    expect(pageSource).toContain("canViewTenantCustomers(context.access)");
    expect(pageSource).toContain('.eq("tenant_id", context.tenantId)');
    expect(pageSource).not.toContain("createSupabaseAdminClient");
    expect(navigationSource).toContain(
      '...(role === "ADMIN" ? [{ href: "/admin/customers"',
    );
  });
});
