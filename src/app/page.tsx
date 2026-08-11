import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { claimFilter } from "@/lib/claims";
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
  const user = await requirePageUser(["admin", "sales", "reviewer"]);

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // Zaken die een collega op dit moment voor zich heeft, blijven uit je
  // wachtrij. Zonder dit krijgen twee mensen die tegelijk beginnen dezelfde
  // bovenste lead en belt de zaak twee keer.
  const mine = claimFilter(user.id, now);

  const [triageLeads, callLeads, clearedToday] = await Promise.all([
    // Freshly found, not yet decided on. Businesses already running a machine
    // come first — they are proven buyers.
    prisma.lead.findMany({
      where: {
        doNotContact: false,
        complianceStatus: "PENDING",
        status: "NEW",
        AND: [mine],
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
        AND: [
          { OR: [{ nextActionAt: { lte: now } }, { nextActionAt: null }] },
          mine,
        ],
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
