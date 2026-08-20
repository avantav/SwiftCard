"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useId, useRef, useState } from "react";

type LocationErrors = {
  address?: string[];
  geofenceRadiusMeters?: string[];
  latitude?: string[];
  longitude?: string[];
};

type BranchLocationPickerProps = {
  defaultAddress: string;
  defaultLatitude: string;
  defaultLongitude: string;
  defaultRadius: string;
  errors?: LocationErrors;
};

const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
let mapsConfigured = false;

function configureMaps() {
  if (mapsConfigured) return;
  setOptions({ key: mapsApiKey, v: "weekly", language: "es", region: "MX" });
  mapsConfigured = true;
}

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return <span className="field-error-message" id={id}>{messages.join(" ")}</span>;
}

function coordinate(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function BranchLocationPicker({
  defaultAddress,
  defaultLatitude,
  defaultLongitude,
  defaultRadius,
  errors = {},
}: BranchLocationPickerProps) {
  const id = useId();
  const mapElementRef = useRef<HTMLDivElement>(null);
  const autocompleteHostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const [address, setAddress] = useState(defaultAddress);
  const [latitude, setLatitude] = useState(defaultLatitude);
  const [longitude, setLongitude] = useState(defaultLongitude);
  const [radius, setRadius] = useState(defaultRadius);
  const [shouldLoadMap, setShouldLoadMap] = useState(false);
  const [status, setStatus] = useState(
    defaultLatitude && defaultLongitude
      ? "Ubicación guardada. Puedes buscar otro lugar o ajustar el punto en el mapa."
      : "Busca el negocio o una dirección para fijar el centro del geofence.",
  );
  const [mapError, setMapError] = useState(
    mapsApiKey ? "" : "Falta configurar NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para usar el buscador y el mapa.",
  );

  useEffect(() => {
    const element = mapElementRef.current;
    if (!element || !mapsApiKey) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShouldLoadMap(true);
        observer.disconnect();
      }
    }, { rootMargin: "120px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mapsApiKey || !shouldLoadMap || !mapElementRef.current || !autocompleteHostRef.current) return;
    let cancelled = false;
    let clickListener: google.maps.MapsEventListener | null = null;
    let autocomplete: google.maps.places.PlaceAutocompleteElement | null = null;

    async function initialize() {
      try {
        configureMaps();
        const [{ Map, Circle }, { PlaceAutocompleteElement }] = await Promise.all([
          importLibrary("maps"),
          importLibrary("places"),
        ]);
        if (cancelled || !mapElementRef.current || !autocompleteHostRef.current) return;

        const savedLatitude = coordinate(defaultLatitude);
        const savedLongitude = coordinate(defaultLongitude);
        const center = savedLatitude !== null && savedLongitude !== null
          ? { lat: savedLatitude, lng: savedLongitude }
          : { lat: 23.2494, lng: -106.4111 };
        const map = new Map(mapElementRef.current, {
          center,
          zoom: savedLatitude !== null ? 17 : 12,
          clickableIcons: false,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
        });
        const circle = new Circle({
          center,
          fillColor: "#149c91",
          fillOpacity: 0.14,
          map,
          radius: Math.max(1, Number(defaultRadius) || 100),
          strokeColor: "#0f7e75",
          strokeOpacity: 0.9,
          strokeWeight: 2,
        });
        mapRef.current = map;
        circleRef.current = circle;

        autocomplete = new PlaceAutocompleteElement({
          description: "Buscar negocio o dirección de la sucursal",
          includedRegionCodes: ["mx"],
          placeholder: "Buscar negocio o dirección",
          requestedLanguage: "es",
          requestedRegion: "mx",
          value: defaultAddress,
        });
        autocomplete.className = "branch-place-autocomplete";
        autocomplete.addEventListener("gmp-error", () => {
          setMapError("Google Maps no pudo completar la búsqueda. Revisa la clave, APIs habilitadas y facturación.");
        });
        autocomplete.addEventListener("gmp-select", async (event) => {
          const place = event.placePrediction.toPlace();
          try {
            await place.fetchFields({ fields: ["displayName", "formattedAddress", "location", "viewport"] });
            if (!place.location) {
              setMapError("El resultado seleccionado no incluye coordenadas. Elige otra sugerencia.");
              return;
            }
            const nextAddress = place.formattedAddress || place.displayName || autocomplete?.value || "";
            const nextCenter = { lat: place.location.lat(), lng: place.location.lng() };
            setAddress(nextAddress);
            setLatitude(nextCenter.lat.toFixed(7));
            setLongitude(nextCenter.lng.toFixed(7));
            setMapError("");
            setStatus("Ubicación encontrada y coordenadas actualizadas.");
            map.setCenter(nextCenter);
            if (place.viewport) map.fitBounds(place.viewport);
            else map.setZoom(17);
            circle.setCenter(nextCenter);
          } catch {
            setMapError("No se pudieron cargar los datos de ese lugar. Intenta con otra sugerencia.");
          }
        });
        autocompleteHostRef.current.replaceChildren(autocomplete);

        clickListener = map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;
          const nextCenter = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          setLatitude(nextCenter.lat.toFixed(7));
          setLongitude(nextCenter.lng.toFixed(7));
          setStatus("Punto ajustado en el mapa. Conservamos la dirección seleccionada.");
          circle.setCenter(nextCenter);
          map.panTo(nextCenter);
        });
      } catch {
        if (!cancelled) {
          setMapError("Google Maps no pudo iniciar. Revisa la clave, las restricciones del dominio y las APIs habilitadas.");
        }
      }
    }

    void initialize();
    return () => {
      cancelled = true;
      clickListener?.remove();
      autocomplete?.remove();
      mapRef.current = null;
      circleRef.current = null;
    };
  }, [defaultAddress, defaultLatitude, defaultLongitude, defaultRadius, shouldLoadMap]);

  useEffect(() => {
    const value = Math.max(1, Number(radius) || 1);
    circleRef.current?.setRadius(value);
  }, [radius]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMapError("Este navegador no permite obtener la ubicación actual.");
      return;
    }
    setStatus("Obteniendo tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCenter = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLatitude(nextCenter.lat.toFixed(7));
        setLongitude(nextCenter.lng.toFixed(7));
        setMapError("");
        setStatus(`Ubicación actual aplicada (precisión aproximada: ${Math.round(position.coords.accuracy)} m).`);
        mapRef.current?.setCenter(nextCenter);
        mapRef.current?.setZoom(17);
        circleRef.current?.setCenter(nextCenter);
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "El permiso de ubicación fue rechazado. Habilítalo en el navegador o busca el lugar."
          : "No pudimos obtener tu ubicación actual. Busca el lugar en el mapa.";
        setMapError(message);
        setStatus("La ubicación no se modificó.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  const addressErrorId = `${id}-address-error`;
  const latitudeErrorId = `${id}-latitude-error`;
  const longitudeErrorId = `${id}-longitude-error`;
  const radiusErrorId = `${id}-radius-error`;

  return <fieldset className="branch-location-picker">
    <legend>Ubicación y geofence</legend>
    <p className="branch-location-copy">Busca la ubicación y ajusta el punto con un clic. El círculo muestra el radio donde se permiten operaciones.</p>
    <input name="address" type="hidden" value={address} />
    <input name="latitude" type="hidden" value={latitude} />
    <input name="longitude" type="hidden" value={longitude} />
    <div className="field">
      <span id={`${id}-search-label`}>Buscar lugar</span>
      <div aria-labelledby={`${id}-search-label`} className="branch-place-host" ref={autocompleteHostRef} />
    </div>
    <div className="branch-map-shell">
      <div aria-label="Mapa para seleccionar la ubicación de la sucursal" className="branch-map" ref={mapElementRef} role="application" />
      <span aria-hidden="true" className="branch-map-center-pin">●</span>
    </div>
    {mapError ? <p className="enterprise-alert is-error branch-map-alert" role="alert">{mapError}</p> : null}
    <div className="branch-location-actions">
      <button className="secondary-button" onClick={useCurrentLocation} type="button">Usar mi ubicación actual</button>
      <p aria-live="polite" role="status">{status}</p>
    </div>
    <div className="branch-location-selection">
      <div><span>Dirección seleccionada</span><strong>{address || "Sin dirección seleccionada"}</strong></div>
      <div><span>Coordenadas</span><strong>{latitude && longitude ? `${latitude}, ${longitude}` : "Sin coordenadas"}</strong></div>
    </div>
    <FieldError id={addressErrorId} messages={errors.address} />
    <FieldError id={latitudeErrorId} messages={errors.latitude} />
    <FieldError id={longitudeErrorId} messages={errors.longitude} />
    <label className="field">
      <span>Radio operativo (metros)</span>
      <input
        aria-describedby={errors.geofenceRadiusMeters?.length ? radiusErrorId : `${id}-radius-hint`}
        aria-invalid={Boolean(errors.geofenceRadiusMeters?.length)}
        max={100000}
        min={1}
        name="geofenceRadiusMeters"
        onChange={(event) => setRadius(event.target.value)}
        required
        step={1}
        type="number"
        value={radius}
      />
      <span className="field-hint" id={`${id}-radius-hint`}>Entre 1 y 100000 metros. El valor recomendado depende de la precisión GPS dentro del local.</span>
      <FieldError id={radiusErrorId} messages={errors.geofenceRadiusMeters} />
    </label>
  </fieldset>;
}
