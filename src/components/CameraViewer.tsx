"use client";

import { useState } from "react";
import type { CameraStream } from "@/lib/camera-streams";

/**
 * Eén camera tegelijk in beeld.
 *
 * Een deellink van UniFi laat maar één kijker toe: zeven beelden naast elkaar
 * verdringen elkaar en dan werkt er geen enkele. Daarom staat er een keuzelijst
 * en wordt pas een stream geopend als je hem aanklikt — wie de pagina alleen
 * opent, bezet nog geen verbinding.
 */
export function CameraViewer({ streams }: { streams: CameraStream[] }) {
  const [active, setActive] = useState<CameraStream | null>(null);

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label="Camera kiezen">
        {streams.map((stream) => (
          <button
            key={stream.url}
            type="button"
            className={
              active?.url === stream.url ? "btn btn-primary btn-sm" : "btn btn-sm"
            }
            onClick={() => setActive(stream)}
          >
            {stream.name}
          </button>
        ))}
        {active ? (
          <button type="button" className="btn btn-sm" onClick={() => setActive(null)}>
            Sluiten
          </button>
        ) : null}
      </nav>

      {active ? (
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-[var(--border)]">
            <span className="label">{active.name}</span>
            <a
              href={active.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[var(--accent)]"
            >
              In apart venster openen
            </a>
          </div>
          <iframe
            key={active.url}
            src={active.url}
            title={`Live beeld ${active.name}`}
            allow="autoplay; fullscreen"
            className="w-full aspect-video border-0 bg-black"
          />
        </section>
      ) : (
        <p className="text-sm text-[var(--text-dim)]">
          Kies een camera om het beeld te openen.
        </p>
      )}

      <p className="text-xs text-[var(--text-dim)]">
        Het beeld loopt rechtstreeks van de camera naar je browser, niet via MATO
        OS. Eén kijker tegelijk per camera: staat dit scherm elders al open, dan
        blijft het hier zwart. Een deellink verloopt na verloop van tijd; werkt
        een camera niet meer, maak de link dan opnieuw aan in UniFi Protect.
      </p>
    </div>
  );
}
