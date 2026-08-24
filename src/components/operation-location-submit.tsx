"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";

type OperationLocationSubmitProps = {
  className?: string;
  locationRequired: boolean;
  children: React.ReactNode;
};

export function OperationLocationSubmit({
  className = "operations-primary-button",
  locationRequired,
  children,
}: OperationLocationSubmitProps) {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const hasLocation = Boolean(latitude && longitude);

  function requestLocation() {
    if (!navigator.geolocation) {
      setError("Este dispositivo no permite compartir la ubicación.");
      return;
    }
    setLocating(true);
    setError("");
    setStatus("Obteniendo ubicación precisa…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(7));
        setLongitude(position.coords.longitude.toFixed(7));
        setStatus(`Ubicación lista · precisión aproximada ${Math.round(position.coords.accuracy)} m.`);
        setLocating(false);
      },
      (geolocationError) => {
        const message = geolocationError.code === geolocationError.PERMISSION_DENIED
          ? "Permiso rechazado. Habilita la ubicación para este sitio en el navegador."
          : geolocationError.code === geolocationError.TIMEOUT
            ? "La ubicación tardó demasiado. Acércate a una ventana o activa el GPS e intenta de nuevo."
            : "No pudimos obtener la ubicación. Activa el GPS e intenta de nuevo.";
        setError(message);
        setStatus("");
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  return <div className="operation-location-submit">
    <input name="operationLatitude" type="hidden" value={latitude} />
    <input name="operationLongitude" type="hidden" value={longitude} />
    <div className={`operation-location-check ${locationRequired ? "" : "is-optional"}`}>
      <div><strong>{locationRequired ? "Validación de ubicación activa" : "Ubicación de la operación"}</strong><p>{locationRequired ? "Compararemos el GPS de este dispositivo con el radio de la sucursal seleccionada." : "Puedes adjuntar el GPS para diagnóstico; en modo flexible no bloquea la operación."}</p></div>
      <button className="operations-secondary-button" disabled={locating} onClick={requestLocation} type="button">
        {locating ? "Obteniendo GPS…" : hasLocation ? "Actualizar ubicación" : "Compartir ubicación"}
      </button>
    </div>
    {error ? <p className="operations-alert is-error" role="alert">{error}</p> : null}
    {status ? <p className="operation-location-status" role="status">{status}</p> : null}
    <SubmitButton className={className} disabled={locationRequired && !hasLocation}>{children}</SubmitButton>
  </div>;
}
