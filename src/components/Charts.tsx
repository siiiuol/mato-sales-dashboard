import type { DayBucket } from "@/lib/team-stats";

/**
 * Grafieken als kale SVG, zonder bibliotheek.
 *
 * Wat hier nodig is — een staafreeks en een verdeling — is een handvol
 * rechthoeken. Een grafiekbibliotheek zou daar ongeveer honderd kilobyte
 * JavaScript voor meebrengen en de vormgeving losweken van de rest van de app.
 *
 * Eén tint per grafiek: er is telkens maar één reeks, dus kleur draagt geen
 * betekenis en hoeft niets te onderscheiden. Bij de belresultaten staat de naam
 * naast elke balk, waardoor kleur daar hooguit herhaalt wat er al staat.
 */

const AXIS = "var(--text-mute)";
const GRID = "var(--border)";

export function DailyBars({
  buckets,
  label,
}: {
  buckets: DayBucket[];
  label: string;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const width = 100;
  const height = 34;
  const gap = 0.6;
  const slot = width / buckets.length;
  const barWidth = Math.max(0.8, slot - gap);
  const total = buckets.reduce((sum, b) => sum + b.count, 0);

  if (total === 0) {
    return (
      <div className="space-y-2">
        <div className="label">{label}</div>
        <p className="text-sm text-[var(--text-dim)]">
          Nog geen gesprekken in deze periode.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline gap-2">
        <span className="label">{label}</span>
        <span className="mono text-xs text-[var(--text-dim)]">
          {total} totaal · piek {max}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height + 4}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: ${total} gesprekken, hoogste dag ${max}`}
        className="w-full"
        style={{ height: 120 }}
      >
        {/* Terughoudende nullijn: hij hoort de staven te dragen, niet op te vallen. */}
        <line
          x1="0"
          y1={height}
          x2={width}
          y2={height}
          stroke={GRID}
          strokeWidth="0.3"
        />
        {buckets.map((bucket, index) => {
          const barHeight = (bucket.count / max) * height;
          return (
            <rect
              key={bucket.key}
              x={index * slot + gap / 2}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              rx="0.4"
              fill="var(--gold)"
            >
              <title>{`${bucket.label}: ${bucket.count}`}</title>
            </rect>
          );
        })}
      </svg>

      <div className="flex justify-between mono text-[0.65rem]" style={{ color: AXIS }}>
        <span>{buckets[0]?.label}</span>
        <span>{buckets[buckets.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export type Distribution = { label: string; count: number; tone?: string };

/**
 * Horizontale verdeling met de naam naast elke balk.
 *
 * Horizontaal en niet als taartdiagram: de namen zijn lang, en lengtes naast
 * elkaar zijn nauwkeuriger te vergelijken dan taartpunten.
 */
export function DistributionBars({
  rows,
  label,
}: {
  rows: Distribution[];
  label: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="space-y-2">
      <div className="label">{label}</div>
      {total === 0 ? (
        <p className="text-sm text-[var(--text-dim)]">Nog niets genoteerd.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.label} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2">
              <span className="text-xs truncate" title={row.label}>
                {row.label}
              </span>
              <span
                className="h-2 rounded-sm block"
                style={{
                  width: `${Math.max(2, (row.count / max) * 100)}%`,
                  background: row.tone ?? "var(--gold)",
                }}
              />
              <span className="mono text-xs text-right text-[var(--text-dim)]">
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
