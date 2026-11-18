import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BRANCH_CREATE_STEP_FIELDS, branchCreateStepErrors, validateSharedAccessCredentials } from "./branches";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("guided branch creation steps (DEC-0073)", () => {
  it("only reports the errors of the step being continued", () => {
    const data = form({ name: "", geofenceRadiusMeters: "100", employeeAccessMode: "SHARED_ACCOUNT_PIN", sharedEmail: "malo", sharedPassword: "corta", sharedPasswordConfirmation: "otra" });
    expect(Object.keys(branchCreateStepErrors(data, 0))).toEqual(["name"]);
    const access = branchCreateStepErrors(data, 2);
    expect(Object.keys(access).every((field) => (BRANCH_CREATE_STEP_FIELDS[2] as readonly string[]).includes(field))).toBe(true);
    expect(access.sharedEmail?.length).toBeGreaterThan(0);
    expect(branchCreateStepErrors(form({ name: "Centro", geofenceRadiusMeters: "100", employeeAccessMode: "INDIVIDUAL_CREDENTIALS" }), 0)).toEqual({});
  });

  it("maps shared credential problems to their fields", () => {
    const result = validateSharedAccessCredentials(form({ sharedEmail: "malo", sharedPassword: "corta", sharedPasswordConfirmation: "otra" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual(["sharedEmail", "sharedPassword", "sharedPasswordConfirmation"]);
      expect(result.errors).toHaveLength(3);
    }
  });
});

describe("admin flows keep the dialog open on errors (DEC-0073)", () => {
  const read = (path: string) => readFileSync(path, "utf8");

  it("returns state instead of ?error= redirects for creation and settings", () => {
    const branchActions = read("src/app/admin/branches/actions.ts");
    const staffActions = read("src/app/admin/staff/actions.ts");
    const pinActions = read("src/app/admin/staff/pin-actions.ts");
    const cardActions = read("src/app/admin/cards/actions.ts");
    expect(branchActions).not.toContain("redirectWithError");
    expect(branchActions).toContain("Promise<BranchAccessActionState>");
    expect(branchActions).toContain("Promise<GeofencePolicyActionState>");
    expect(staffActions).toContain("Promise<StaffCreateActionState>");
    expect(pinActions).toContain("export async function createPinOperator(_previousState: StaffCreateActionState");
    expect(cardActions).toContain("Promise<CardDraftActionState>");
    expect(cardActions).not.toContain('redirect(`/admin/cards?error=${encodeURIComponent("Escribe un nombre');
  });

  it("confirms success with whitelisted toast notices", () => {
    expect(read("src/app/admin/branches/actions.ts")).toContain('"branch_created"');
    expect(read("src/app/admin/staff/actions.ts")).toContain('"staff_created"');
    expect(read("src/app/admin/cards/actions.ts")).toContain('"card_published"');
  });
});
