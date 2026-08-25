export const OPEN_LEAD_STATUSES = [
  "NEW",
  "TO_CALL",
  "CONTACTED",
  "FOLLOW_UP",
  "NEGOTIATION",
] as const;

export type LeadFocus =
  | "today"
  | "overdue"
  | "stale"
  | "no-next"
  | "triage"
  | "missing-contact"
  | "ownerless";

export function utcDayBounds(now: Date = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function staleCutoff(now: Date = new Date(), days = 14) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function isLeadStale(
  lead: { lastTouchedAt: Date | null; createdAt: Date },
  now: Date = new Date(),
  days = 14
) {
  return (lead.lastTouchedAt ?? lead.createdAt) < staleCutoff(now, days);
}

export function leadFocusWhere(focus: string | undefined, now: Date = new Date()) {
  const { start, end } = utcDayBounds(now);
  const open = { in: [...OPEN_LEAD_STATUSES] };

  switch (focus) {
    case "today":
      return { status: open, nextActionAt: { gte: start, lt: end } };
    case "overdue":
      return { status: open, nextActionAt: { lt: start } };
    case "stale":
      return {
        status: open,
        OR: [
          { lastTouchedAt: { lt: staleCutoff(now) } },
          {
            AND: [
              { lastTouchedAt: null },
              { createdAt: { lt: staleCutoff(now) } },
            ],
          },
        ],
      };
    case "no-next":
      return { status: open, nextActionAt: null };
    case "triage":
      return { status: "NEW", complianceStatus: "PENDING" };
    case "missing-contact":
      return {
        status: open,
        AND: [
          { OR: [{ phone: null }, { phone: "" }] },
          { OR: [{ email: null }, { email: "" }] },
        ],
      };
    case "ownerless":
      return { status: open, ownerId: null };
    default:
      return {};
  }
}

export function shopFreeSlots(
  capacity: number,
  placements: Array<{ shopSlot: number | null }>
) {
  const safeCapacity = Math.max(1, Math.min(40, capacity || 8));
  const occupied = new Set(
    placements
      .map((placement) => placement.shopSlot)
      .filter(
        (slot): slot is number =>
          slot !== null && slot >= 1 && slot <= safeCapacity
      )
  ).size;
  return Math.max(0, safeCapacity - occupied);
}
