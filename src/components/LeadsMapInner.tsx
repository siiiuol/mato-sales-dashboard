"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import type { MapPoint } from "./LeadsMap";
import "leaflet/dist/leaflet.css";

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const latLngs = points.map((p) => [p.lat, p.lng] as [number, number]);
    if (latLngs.length === 1) {
      map.setView(latLngs[0], 12);
      return;
    }
    map.fitBounds(latLngs, { padding: [28, 28], maxZoom: 12 });
  }, [map, points]);
  return null;
}

export default function LeadsMapInner({ points }: { points: MapPoint[] }) {
  const center: [number, number] = [51.0, 4.4];

  return (
    <div className="relative">
      {!points.length && (
        <div className="absolute inset-x-0 top-0 z-[500] pointer-events-none p-3">
          <p className="mono text-xs text-[var(--text-dim)] bg-[rgba(8,12,16,0.72)] border border-[var(--border)] px-3 py-2 inline-block">
            No leads on the map yet — use Search for leads above
          </p>
        </div>
      )}
      <MapContainer
        center={center}
        zoom={8}
        className="h-[320px] w-full rounded-[2px] z-0"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds points={points} />
        {points.map((p) => (
          <CircleMarker
            key={`${p.type}-${p.id}`}
            center={[p.lat, p.lng]}
            radius={p.type === "customer" ? 8 : 6}
            pathOptions={{
              color: p.type === "customer" ? "#3de7ff" : "#39ff8a",
              fillColor: p.type === "customer" ? "#3de7ff" : "#39ff8a",
              fillOpacity: 0.7,
              weight: 1,
            }}
          >
            <Popup>
              <strong>{p.name}</strong>
              <br />
              {p.type} · score {p.score}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
