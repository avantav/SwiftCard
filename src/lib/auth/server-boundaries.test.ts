import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const changePasswordAction = readFileSync(
  join(process.cwd(), "src/app/change-password/actions.ts"),
  "utf8"
);
const loginAction = readFileSync(
  join(process.cwd(), "src/app/login/actions.ts"),
  "utf8"
);
const middlewareSource = readFileSync(
  join(process.cwd(), "middleware.ts"),
  "utf8"
);

function readLayout(area: "superadmin" | "admin" | "app") {
  return readFileSync(join(process.cwd(), `src/app/${area}/layout.tsx`), "utf8");
}

describe("password change server boundary", () => {
  it("updates Auth before completing the profile through the admin client", () => {
    const passwordUpdate = changePasswordAction.indexOf(
      "supabase.auth.updateUser"
    );
    const profileCompletion = changePasswordAction.indexOf(
      'adminClient.rpc(\n    "complete_required_password_change"'
    );

    expect(changePasswordAction).toContain("createSupabaseAdminClient");
    expect(passwordUpdate).toBeGreaterThan(-1);
    expect(profileCompletion).toBeGreaterThan(passwordUpdate);
  });

  it("redirects reset-required users immediately after login", () => {
    expect(loginAction).toContain(
      'profile.status === "PASSWORD_RESET_REQUIRED"'
    );
    expect(loginAction).toContain('redirect("/change-password")');
  });

  it("protects password change in middleware", () => {
    expect(middlewareSource).toContain('"/change-password"');
  });

  it("guards every internal route tree dynamically", () => {
    for (const [area, expectedGuard] of [
      ["superadmin", 'requireInternalArea("SUPERADMIN")'],
      ["admin", 'requireInternalArea("ADMIN")'],
      ["app", 'requireInternalArea("APP")']
    ] as const) {
      const layout = readLayout(area);

      expect(layout).toContain('dynamic = "force-dynamic"');
      expect(layout).toContain(expectedGuard);
    }
  });
});
