export type BranchCreateInput = {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
  proximityEnabled: boolean;
};

export type BranchCreateValidationResult =
  | { ok: true; data: BranchCreateInput }
  | { ok: false; errors: string[] };

function text(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function optionalCoordinate(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function validateBranchCreateForm(
  formData: FormData
): BranchCreateValidationResult {
  const errors: string[] = [];
  const name = text(formData, "name");
  const address = text(formData, "address") || null;
  const latitude = optionalCoordinate(text(formData, "latitude"));
  const longitude = optionalCoordinate(text(formData, "longitude"));
  const radius = Number(text(formData, "geofenceRadiusMeters"));

  if (!name) {
    errors.push("Nombre es obligatorio.");
  }

  if ((latitude === null) !== (longitude === null)) {
    errors.push("Latitud y longitud deben capturarse juntas.");
  }

  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    errors.push("La latitud debe estar entre -90 y 90.");
  }

  if (
    longitude !== null &&
    (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
  ) {
    errors.push("La longitud debe estar entre -180 y 180.");
  }

  if (!Number.isInteger(radius) || radius < 1 || radius > 100000) {
    errors.push("El radio debe ser un entero entre 1 y 100000 metros.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      name,
      address,
      latitude,
      longitude,
      geofenceRadiusMeters: radius,
      proximityEnabled: formData.get("proximityEnabled") === "on"
    }
  };
}
