import { readFileSync } from "node:fs";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";

const branchesPageSource = readFileSync(
  new URL("../../app/admin/branches/page.tsx", import.meta.url),
  "utf8",
);

describe("public registration sharing", () => {
  it("generates a downloadable PNG QR for a public registration URL", async () => {
    const qr = await QRCode.toDataURL(
      "https://rewards.example.com/register/opaque-branch-token",
      { errorCorrectionLevel: "M", width: 512 },
    );

    expect(qr).toMatch(/^data:image\/png;base64,/);
  });

  it("keeps registration links inside the admin-only branch page", () => {
    expect(branchesPageSource).toContain('requireInternalArea("ADMIN")');
    expect(branchesPageSource).toContain('context.access.role !== "ADMIN"');
    expect(branchesPageSource).toContain("public_registration_token");
    expect(branchesPageSource).toContain("SWIFTWALLET_PUBLIC_URL");
    expect(branchesPageSource).toContain("PublicRegistrationShare");
    expect(branchesPageSource).toContain('branch.status !== "ACTIVE"');
  });
});
