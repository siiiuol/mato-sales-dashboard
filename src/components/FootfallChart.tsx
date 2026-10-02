import type { DailyFootfall } from "@/lib/camera-events";

/** Eenvoudige staafdiagram van dagelijkse persoonsdetecties — één reeks, geen legende nodig. */
export function FootfallChart({ data }: { data: DailyFootfall[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const width = 700;
  const height = 160;
  const padBottom = 20;
  const gap = 4;
  const barWidth = data.length ? (width - gap * (data.length - 1)) / data.length : 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-40"
      role="img"
      aria-label="Persoonsdetecties per dag"
    >
      <line
        x1={0}
        y1={height - padBottom}
        x2={width}
        y2={height - padBottom}
        stroke="var(--line)"
        strokeWidth={1}
      />
      {data.map((d, i) => {
        const barHeight = (d.count / max) * (height - padBottom - 8);
        const x = i * (barWidth + gap);
        const y = height - padBottom - barHeight;
        return (
          <rect
            key={d.date}
            x={x}
            y={y}
            width={Math.max(1, barWidth)}
            height={Math.max(0, barHeight)}
            rx={Math.min(4, barWidth / 2)}
            fill="var(--accent)"
          >
            {/* Eén enkele tekstnode: React serveert een <title> met meerdere
                kinderen leeg uit, waarna de client hem alsnog vult — precies het
                verschil dat een hydration-mismatch oplevert. */}
            <title>{`${d.label} — ${d.count} ${
              d.count === 1 ? "detectie" : "detecties"
            }`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
