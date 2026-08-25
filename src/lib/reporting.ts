export const MIN_REPORT_SAMPLE = 10;

export function conversionDisplay(
  won: number,
  total: number,
  minimum = MIN_REPORT_SAMPLE
) {
  if (total < minimum) return "te weinig data";
  const rate = (won / total) * 100;
  if (won > 0 && rate < 1) return "<1%";
  return `${Math.round(rate)}%`;
}

export function averageCycleDays(
  deals: Array<{ createdAt: Date; wonAt: Date | null }>
) {
  const durations = deals
    .filter((deal): deal is { createdAt: Date; wonAt: Date } => Boolean(deal.wonAt))
    .map((deal) => Math.max(0, deal.wonAt.getTime() - deal.createdAt.getTime()));
  if (!durations.length) return null;
  return (
    durations.reduce((sum, duration) => sum + duration, 0) /
    durations.length /
    86_400_000
  );
}

export function countBy<T>(
  rows: T[],
  key: (row: T) => string | null | undefined
) {
  const result = new Map<string, number>();
  for (const row of rows) {
    const label = key(row)?.trim() || "Onbekend";
    result.set(label, (result.get(label) ?? 0) + 1);
  }
  return [...result.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
