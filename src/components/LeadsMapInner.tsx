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
          <p className="mono text-xs text-[var(--text-dim)] bg-[var(--surface)] shadow-[var(--shadow-sm)] border border-[var(--border)] px-3 py-2 inline-block">
            Nog geen leads op de kaart — klik hierboven op Leads zoeken
          </p>
        </div>
      )}
      <MapContainer
        center={center}
        zoom={8}
        className="h-[320px] w-full rounded-none z-0"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds points={points} />
        {points.map((p) => (
          <CircleMarker
            key={`${p.type}-${p.id}`}
            center={[p.lat, p.lng]}
            radius={p.type === "won" ? 8 : 6}
            pathOptions={{
              // A white ring separates each dot from the map underneath.
              // Gold = still to work, deep green = won. Literals rather than
              // tokens because Leaflet writes these straight into SVG.
              color: "#ffffff",
              fillColor: p.type === "won" ? "#1f6b45" : "#a97a1f",
              fillOpacity: 0.9,
              weight: 1.5,
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
