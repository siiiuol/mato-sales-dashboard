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
          `Found ${res.created} new lead${res.created === 1 ? "" : "s"} in ${zone}` +
            (res.skipped ? ` · ${res.skipped} already known` : "") +
            ` · ${sourceLabel}`
        );
        if (res.placesProblem) setWarning(res.placesProblem);
        else if (res.coverage) setCoverage(res.coverage);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      }
    });
  };

  return (
    <section className="panel p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="label text-[var(--accent)]">Search for leads</h2>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Searches every town in the zone for bakeries, patisseries, butchers,
          chocolatiers, ice-cream shops and farm shops — plus any that already run
          a vending machine. Search the same zone again to fill gaps; nothing is
          duplicated.
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
          {pending ? "Searching…" : "Search for leads"}
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
