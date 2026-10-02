import type { DailyFootfall, HourBucket } from "@/lib/camera-events";
import { FootfallChart } from "./FootfallChart";

/**
 * Cameraverkeer als één paneel in plaats van losse cijfervakjes.
 *
 * De vraag die dit moet beantwoorden is niet "hoeveel detecties", maar "wanneer
 * loopt er volk langs en bij welke automaat" — daar kun je bijvullen en plaatsen
 * op afstemmen. Het dagtotaal staat er wel, maar ondergeschikt.
 */
export function CameraPanel({
  total,
  daily,
  hourly,
  perCamera,
  peak,
  days,
}: {
  total: number;
  daily: DailyFootfall[];
  hourly: HourBucket[];
  perCamera: Array<{ label: string; count: number }>;
  peak: HourBucket | null;
  days: number;
}) {
  const maxHour = Math.max(1, ...hourly.map((h) => h.count));
  const maxCamera = Math.max(1, ...perCamera.map((c) => c.count));
  const perDay = Math.round(total / Math.max(1, days));

  return (
    <section className="panel p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="label text-[var(--accent)]">Cameraverkeer Diksmuide</h2>
        <span className="text-xs text-[var(--text-dim)]">bèta</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <p className="display text-3xl">{perDay.toLocaleString("nl-BE")}</p>
        <p className="text-sm text-[var(--text-dim)]">
          passanten per dag, gemiddeld over {days} {days === 1 ? "dag" : "dagen"}
          {peak ? (
            <>
              {" · drukst tussen "}
              <span className="text-[var(--text)]">
                {pad(peak.hour)}&nbsp;en&nbsp;{pad((peak.hour + 1) % 24)} u
              </span>
            </>
          ) : null}
        </p>
      </div>

      <div className="space-y-2">
        <p className="label">Over de dag</p>
        <svg
          viewBox="0 0 480 90"
          className="w-full h-24"
          role="img"
          aria-label="Persoonsdetecties per uur van de dag"
        >
          <line x1={0} y1={72} x2={480} y2={72} stroke="var(--line)" strokeWidth={1} />
          {hourly.map((bucket) => {
            const w = 480 / 24;
            const x = bucket.hour * w;
            const h = (bucket.count / maxHour) * 64;
            const isPeak = peak != null && bucket.hour === peak.hour;
            return (
              <rect
                key={bucket.hour}
                x={x + 1.5}
                y={72 - h}
                width={w - 3}
                height={Math.max(0, h)}
                rx={2}
                fill={isPeak ? "var(--accent)" : "var(--gold-wash-strong)"}
              >
                <title>{`${pad(bucket.hour)}–${pad((bucket.hour + 1) % 24)} u — ${
                  bucket.count
                } ${bucket.count === 1 ? "detectie" : "detecties"}`}</title>
              </rect>
            );
          })}
          {[0, 6, 12, 18].map((h) => (
            <text
              key={h}
              x={h * (480 / 24) + 2}
              y={86}
              fontSize={9}
              fill="var(--text-dim)"
            >
              {pad(h)}u
            </text>
          ))}
        </svg>
      </div>

      {/* Zolang UniFi geen cameranaam meestuurt, valt alles in één naamloze bak.
          Een balk van 100% "Onbekende camera" suggereert een verdeling die er
          niet is; dan is zeggen wat eraan ontbreekt eerlijker. */}
      {perCamera.length === 1 && perCamera[0].label === "Onbekende camera" ? (
        <div className="space-y-2">
          <p className="label">Per automaat</p>
          <p className="text-sm text-[var(--text-dim)]">
            Nog niet te splitsen: de meldingen komen binnen zonder cameranaam.
            Geef elke camera in UniFi een eigen webhook-regel met{" "}
            <span className="mono">&amp;camera=…</span> in de URL, dan verschijnt
            de verdeling hier.
          </p>
        </div>
      ) : (
      <div className="space-y-2">
        <p className="label">Per automaat</p>
        <ul className="space-y-1.5">
          {perCamera.map((row) => (
            <li key={row.label} className="flex items-center gap-3 text-sm">
              <span className="w-40 shrink-0 truncate" title={row.label}>
                {row.label}
              </span>
              <span className="flex-1 h-2 rounded-full bg-[var(--surface-3)] overflow-hidden">
                <span
                  className="block h-full rounded-full bg-[var(--accent-dim)]"
                  style={{ width: `${Math.round((row.count / maxCamera) * 100)}%` }}
                />
              </span>
              <span className="mono text-xs text-[var(--text-dim)] w-16 text-right">
                {Math.round((row.count / Math.max(1, total)) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
      )}

      <details className="group">
        <summary className="label cursor-pointer text-[var(--text-dim)] hover:text-[var(--text)]">
          Laatste 14 dagen
        </summary>
        <div className="mt-3">
          <FootfallChart data={daily} />
        </div>
      </details>

      <p className="text-xs text-[var(--text-dim)]">
        Eén detectie is één persoon die langs een camera komt, niet één klant:
        wie twee automaten passeert telt twee keer, en personeel telt mee.
        Bruikbaar om drukte te vergelijken, niet als bezoekersaantal.
      </p>
    </section>
  );
}

function pad(hour: number): string {
  return String(hour).padStart(2, "0");
}
