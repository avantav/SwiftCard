import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSetupChecklist } from "./onboarding";

const empty = { legalComplete: false, activeBranches: 0, branchesWithoutLocation: 0, publishedCards: 0, staffMembers: 0 };

describe("first-run setup checklist (DEC-0073)", () => {
  it("starts with the legal data and points to one next step", () => {
    const checklist = buildSetupChecklist(empty);
    expect(checklist.completed).toBe(0);
    expect(checklist.total).toBe(5);
    expect(checklist.next?.id).toBe("legal");
  });

  it("requires every active branch to have a location", () => {
    const checklist = buildSetupChecklist({ ...empty, legalComplete: true, activeBranches: 2, branchesWithoutLocation: 1 });
    expect(checklist.next?.id).toBe("location");
    expect(checklist.steps.find((step) => step.id === "location")?.description).toContain("1 sucursal activa necesita");
    expect(buildSetupChecklist({ ...empty, legalComplete: true }).steps.find((step) => step.id === "location")?.done).toBe(false);
  });

  it("reports completion when everything is ready", () => {
    const checklist = buildSetupChecklist({ legalComplete: true, activeBranches: 1, branchesWithoutLocation: 0, publishedCards: 1, staffMembers: 3 });
    expect(checklist.completed).toBe(5);
    expect(checklist.next).toBeNull();
  });

  it("counts with the session client scoped to the context tenant", () => {
    const loader = readFileSync("src/lib/admin/onboarding-server.ts", "utf8");
    const home = readFileSync("src/app/admin/page.tsx", "utf8");
    expect(loader).not.toContain("createSupabaseAdminClient");
    expect(loader.match(/\.eq\("tenant_id", tenantId\)/g)?.length).toBe(3);
    expect(home).toContain("loadSetupChecklist(context.supabase, context.tenantId)");
    expect(home).toContain("!context.supportSession");
    expect(home).not.toContain("/admin/program");
  });
});
