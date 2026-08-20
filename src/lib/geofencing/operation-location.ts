export type OperationCoordinates = {
  latitude: number | null;
  longitude: number | null;
};

export function readOperationCoordinates(formData: FormData):
  | { ok: true; data: OperationCoordinates }
  | { ok: false; error: string } {
  const latitudeValue = String(formData.get("operationLatitude") ?? "").trim();
  const longitudeValue = String(formData.get("operationLongitude") ?? "").trim();

  if (!latitudeValue && !longitudeValue) {
    return { ok: true, data: { latitude: null, longitude: null } };
  }
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (
    !latitudeValue
    || !longitudeValue
    || !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) {
    return { ok: false, error: "No pudimos validar las coordenadas del dispositivo. Vuelve a compartir tu ubicación." };
  }
  return { ok: true, data: { latitude, longitude } };
}

export function isGeofenceRejection(error: { code?: string; message?: string; details?: string } | null) {
  if (!error) return false;
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return error.code === "23514" && message.includes("operation location");
}

export const GEOFENCE_REJECTION_MESSAGE =
  "La operación fue bloqueada porque el dispositivo está fuera del radio de la sucursal o no pudo compartir una ubicación válida.";
