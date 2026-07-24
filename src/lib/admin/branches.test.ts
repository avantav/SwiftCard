import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateBranchCreateForm } from "./branches";

const branchAction = readFileSync(
  join(process.cwd(), "src/app/admin/branches/actions.ts"),
  "utf8"
);

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("validateBranchCreateForm", () => {
  it("normalizes a valid branch", () => {
    expect(
      validateBranchCreateForm(
        form({
          name: "  Centro  ",
          address: "Av. Principal 10",
          latitude: "23.2494",
          longitude: "-106.4111",
          geofenceRadiusMeters: "150",
          proximityEnabled: "on"
        })
      )
    ).toEqual({
      ok: true,
      data: {
        name: "Centro",
        address: "Av. Principal 10",
        latitude: 23.2494,
        longitude: -106.4111,
        geofenceRadiusMeters: 150,
        proximityEnabled: true
      }
    });
  });

  it("allows omitted coordinates", () => {
    expect(
      validateBranchCreateForm(
        form({ name: "Norte", geofenceRadiusMeters: "100" })
      )
    ).toMatchObject({
      ok: true,
      data: { latitude: null, longitude: null }
    });
  });

  it("rejects incomplete coordinates and invalid radius", () => {
    expect(
      validateBranchCreateForm(
        form({
          name: "",
          latitude: "91",
          geofenceRadiusMeters: "0"
        })
      )
    ).toMatchObject({
      ok: false,
      errors: [
        "Nombre es obligatorio.",
        "Latitud y longitud deben capturarse juntas.",
        "La latitud debe estar entre -90 y 90.",
        "El radio debe ser un entero entre 1 y 100000 metros."
      ]
    });
  });

  it("derives tenant authority from the authenticated context", () => {
    expect(branchAction).toContain("tenant_id: context.tenantId");
    expect(branchAction).toContain('context.access.role !== "ADMIN"');
    expect(branchAction).not.toContain('formData.get("tenant');
  });
});
