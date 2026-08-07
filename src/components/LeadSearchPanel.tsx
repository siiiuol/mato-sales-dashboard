"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FLANDERS_ZONES } from "@/lib/constants";
import { scanZone } from "@/lib/actions";

type ScanResult = {
  created: number;
  skipped: number;
  demo: boolean;
  source?: string;
  coverage?: string;
  placesProblem?: string | null;
};

export function LeadSearchPanel({
  zones = [...FLANDERS_ZONES],
}: {
  zones?: string[];
}) {
  const router = useRouter();
  const [zone, setZone] = useState(zones[0] ?? "Oost-Vlaanderen");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [coverage, setCoverage] = useState("");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");

  const runSearch = () => {
    setError("");
    setMessage("");
    setCoverage("");
    setWarning("");
    start(async () => {
      try {
        const res = (await scanZone(zone)) as ScanResult;
        const sourceLabel =
          res.source === "openstreetmap"
            ? "OpenStreetMap"
            : res.source === "places"
              ? "Google Places"
              : "search";
        setMessage(
          `${res.created} nieuwe lead${res.created === 1 ? "" : "s"} gevonden in ${zone}` +
            (res.skipped ? ` · ${res.skipped} al bekend` : "") +
            ` · ${sourceLabel}`
        );
        if (res.placesProblem) setWarning(res.placesProblem);
        else if (res.coverage) setCoverage(res.coverage);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Zoeken is niet gelukt");
      }
    });
  };

  return (
    <section className="panel p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="label text-[var(--accent)]">Leads zoeken</h2>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Doorzoekt elke gemeente in de zone op bakkerijen, patisserieën,
          slagerijen, chocolatiers, ijssalons en hoevewinkels — en op zaken die al
          een automaat hebben. Zoek dezelfde zone gerust opnieuw; niets wordt
          dubbel toegevoegd.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="flex-1 block">
          <span className="label block mb-1">Zone</span>
          <select
            className="select w-full"
            value={zone}
            disabled={pending}
            onChange={(e) => setZone(e.target.value)}
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-primary sm:min-w-[200px]"
          disabled={pending || !zone}
          onClick={runSearch}
        >
          {pending ? "Bezig met zoeken…" : "Leads zoeken"}
        </button>
      </div>

      {message && (
        <p className="text-sm text-[var(--accent)] mono" role="status">
          {message}
        </p>
      )}
      {coverage && (
        <p className="text-xs text-[var(--text-dim)] mono">{coverage}</p>
      )}
      {warning && (
        <p className="text-sm text-[var(--warn)]" role="alert">
          {warning}
        </p>
      )}
      {error && (
        <p className="text-sm text-[var(--warn)]" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
