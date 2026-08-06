"use client";

import { useTransition } from "react";

export function ScanButton({
  zone,
  action,
}: {
  zone: string;
  action: (zone: string) => Promise<{
    created: number;
    skipped: number;
    demo: boolean;
    source?: string;
  }>;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className={`btn ${pending ? "anim-scan" : ""}`}
      disabled={pending}
      onClick={() =>
        start(() => {
          void action(zone).then((res) => {
            const src =
              res.source === "openstreetmap"
                ? " · OpenStreetMap"
                : res.source === "places"
                  ? " · Google Places"
                  : res.demo
                    ? " · demo"
                    : "";
            alert(`${zone}: +${res.created} leads (${res.skipped} skipped)${src}`);
          });
        })
      }
    >
      {pending ? "Scanning…" : `Scan ${zone}`}
    </button>
  );
}
