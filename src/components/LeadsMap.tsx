"use client";

import dynamic from "next/dynamic";

export type MapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  score: number;
  type: "lead" | "won";
};

const MapInner = dynamic(() => import("./LeadsMapInner"), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] flex items-center justify-center text-[var(--text-dim)] mono text-sm">
      Kaart laden…
    </div>
  ),
});

export function LeadsMap({ points }: { points: MapPoint[] }) {
  return <MapInner points={points} />;
}
