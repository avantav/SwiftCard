"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";

export type MapPurchasePoint = {
  id: string;
  latitude: number;
  longitude: number;
  outside: boolean;
  title: string;
};

export type MapBranchArea = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
let mapsConfigured = false;

/** Semantic state colors from docs/DESIGN_SYSTEM.md §6.2. */
const COLORS = { inside: "#087A55", outside: "#B42318", branch: "#475467" } as const;

function configureMaps() {
  if (mapsConfigured) return;
  setOptions({ key: mapsApiKey, v: "weekly", language: "es", region: "MX" });
  mapsConfigured = true;
}

/**
 * Observation map for the location security view. The table next to it shows
 * the same rows and is the accessible alternative.
 */
export function PurchaseLocationMap({ points, branches, summary }: {
  points: MapPurchasePoint[];
  branches: MapBranchArea[];
  summary: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(mapsApiKey ? "idle" : "error");

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !mapsApiKey) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "200px" });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!visible || !host || !mapsApiKey) return;
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        configureMaps();
        const [{ Map, Circle, InfoWindow }, { Marker }] = await Promise.all([
          importLibrary("maps"),
          importLibrary("marker"),
        ]);
        if (cancelled) return;
        const map = new Map(host, {
          center: { lat: 23.6345, lng: -102.5528 },
          zoom: 5,
          clickableIcons: false,
          fullscreenControl: true,
          mapTypeControl: false,
          streetViewControl: false,
        });
        const bounds = new google.maps.LatLngBounds();
        const info = new InfoWindow();

        for (const branch of branches) {
          const center = { lat: branch.latitude, lng: branch.longitude };
          new Circle({
            map,
            center,
            radius: branch.radiusMeters,
            strokeColor: COLORS.branch,
            strokeOpacity: 0.8,
            strokeWeight: 1.5,
            fillColor: COLORS.branch,
            fillOpacity: 0.08,
            clickable: false,
          });
          new Marker({
            map,
            position: center,
            title: `Sucursal ${branch.name}`,
            icon: { path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 5, fillColor: COLORS.branch, fillOpacity: 1, strokeColor: "#FFFFFF", strokeWeight: 1.5 },
          });
          bounds.extend(center);
        }

        for (const point of points) {
          const position = { lat: point.latitude, lng: point.longitude };
          const marker = new Marker({
            map,
            position,
            title: point.title,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: point.outside ? 7 : 5,
              fillColor: point.outside ? COLORS.outside : COLORS.inside,
              fillOpacity: 0.9,
              strokeColor: "#FFFFFF",
              strokeWeight: 1.5,
            },
            zIndex: point.outside ? 2 : 1,
          });
          marker.addListener("click", () => {
            const content = document.createElement("p");
            content.className = "location-map-info";
            content.textContent = point.title;
            info.setContent(content);
            info.open({ map, anchor: marker });
          });
          bounds.extend(position);
        }

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, 48);
          google.maps.event.addListenerOnce(map, "idle", () => {
            if ((map.getZoom() ?? 0) > 17) map.setZoom(17);
          });
        }
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, points, branches]);

  if (!mapsApiKey) {
    return (
      <p className="enterprise-alert is-info" role="status">
        El mapa no está configurado en este entorno. La tabla muestra las mismas compras.
      </p>
    );
  }

  return (
    <div className="branch-map-shell location-review-map-shell">
      <div ref={hostRef} className="branch-map location-review-map" role="img" aria-label={summary} />
      {status === "loading" || status === "idle" ? <div className="branch-map-loader" aria-hidden="true">Cargando mapa…</div> : null}
      {status === "error" ? (
        <p className="enterprise-alert is-error branch-map-alert" role="alert">
          No se pudo cargar el mapa. La tabla muestra las mismas compras.
        </p>
      ) : null}
    </div>
  );
}
