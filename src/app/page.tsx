import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { WorkMode } from "@/components/WorkMode";

export const dynamic = "force-dynamic";

/** Fields both the triage card and the call card render. */
const LEAD_FIELDS = {
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
  phoneOpener: true,
  recommendedAngle: true,
  recommendedMachine: true,
  discoveryQuestions: true,
  likelyObjection: true,
  evidenceSummary: true,
} as const;

export default async function HomePage() {
  await requirePageUser(["admin", "sales", "reviewer"]);

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [triageLeads, callLeads, clearedToday] = await Promise.all([
    // Freshly found, not yet decided on. Businesses already running a machine
    // come first — they are proven buyers.
    prisma.lead.findMany({
      where: {
        doNotContact: false,
        complianceStatus: "PENDING",
        status: "NEW",
      },
      orderBy: [{ hasVending: "desc" }, { score: "desc" }, { createdAt: "desc" }],
      take: 40,
      select: LEAD_FIELDS,
    }),
    prisma.lead.findMany({
      where: {
        doNotContact: false,
        complianceStatus: "CLEARED",
        status: { in: ["NEW", "TO_CALL", "FOLLOW_UP", "CONTACTED"] },
        OR: [{ nextActionAt: { lte: now } }, { nextActionAt: null }],
      },
      orderBy: [
        { hasVending: "desc" },
        { score: "desc" },
        { timingScore: "desc" },
        { lastTouchedAt: "asc" },
      ],
      take: 20,
      select: LEAD_FIELDS,
    }),
    prisma.outreachEvent.count({
      where: { createdAt: { gte: startOfDay }, type: "CALL" },
    }),
  ]);

  return (
    <WorkMode
      initialTriageLeads={triageLeads}
      initialCallLeads={callLeads}
      clearedToday={clearedToday}
    />
  );
}
