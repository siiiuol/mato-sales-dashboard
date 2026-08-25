import { workableByMe } from "./claims";
import { utcDayBounds } from "./today-dashboard";

export function buildCallQueueWhere(userId: string, now = new Date()) {
  const { end } = utcDayBounds(now);
  return {
    doNotContact: false,
    complianceStatus: "CLEARED",
    status: { in: ["NEW", "TO_CALL", "FOLLOW_UP", "CONTACTED"] },
    AND: [
      { OR: [{ nextActionAt: { lt: end } }, { nextActionAt: null }] },
      ...workableByMe(userId, now),
    ],
  };
}

export const CALL_QUEUE_SELECT = {
  id: true,
  name: true,
  phone: true,
  website: true,
  address: true,
  city: true,
  category: true,
  score: true,
  reason: true,
  hasVending: true,
  vendingDetail: true,
  nearbyVending: true,
  sellsTakeaway: true,
  phoneOpener: true,
  recommendedAngle: true,
  recommendedMachine: true,
  discoveryQuestions: true,
  likelyObjection: true,
  evidenceSummary: true,
  status: true,
  outreach: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      note: true,
      type: true,
      outcome: true,
      createdAt: true,
    },
  },
} as const;

export const CALL_QUEUE_ORDER = [
  { hasVending: "desc" as const },
  { score: "desc" as const },
  { timingScore: "desc" as const },
  { lastTouchedAt: "asc" as const },
] as const;
