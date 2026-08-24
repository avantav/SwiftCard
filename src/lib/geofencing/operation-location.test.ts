import { describe, expect, it } from "vitest";
import {
  isGeofenceRejection,
  readOperationCoordinates,
} from "./operation-location";

describe("operation geofencing", () => {
  it("accepts an omitted location for flexible mode to decide in the database", () => {
    expect(readOperationCoordinates(new FormData())).toEqual({
      ok: true,
      data: { latitude: null, longitude: null },
    });
  });

  it("normalizes a valid browser location", () => {
    const formData = new FormData();
    formData.set("operationLatitude", "23.2494000");
    formData.set("operationLongitude", "-106.4111000");
    expect(readOperationCoordinates(formData)).toEqual({
      ok: true,
      data: { latitude: 23.2494, longitude: -106.4111 },
    });
  });

  it("rejects incomplete and out-of-range coordinates", () => {
    const incomplete = new FormData();
    incomplete.set("operationLatitude", "23");
    expect(readOperationCoordinates(incomplete).ok).toBe(false);
    const invalid = new FormData();
    invalid.set("operationLatitude", "91");
    invalid.set("operationLongitude", "0");
    expect(readOperationCoordinates(invalid).ok).toBe(false);
  });

  it("recognizes only the database geofence rejection", () => {
    expect(isGeofenceRejection({ code: "23514", message: "operation location is outside the branch geofence" })).toBe(true);
    expect(isGeofenceRejection({ code: "23514", message: "another constraint" })).toBe(false);
  });
});
