import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { leadBotFetch } from "@/lib/lead-bot";
import { WorkMode } from "@/components/WorkMode";
import type { Lead } from "@/components/ReviewBoard";

export const dynamic = "force-dynamic";

export default async function WorkPage() {
  await requirePageUser(["admin", "sales", "reviewer"]);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [callLeads, clearedToday, reviewLeads] = await Promise.all([
    prisma.lead.findMany({
      where: {
        doNotContact: false,
        complianceStatus: "CLEARED",
        status: { in: ["NEW", "TO_CALL", "FOLLOW_UP", "CONTACTED"] },
        OR: [{ nextActionAt: { lte: new Date() } }, { nextActionAt: null }],
      },
      orderBy: [
        { score: "desc" },
        { timingScore: "desc" },
        { distanceKm: "asc" },
        { lastTouchedAt: "asc" },
      ],
      take: 20,
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        city: true,
        phoneOpener: true,
        recommendedAngle: true,
        recommendedMachine: true,
        discoveryQuestions: true,
        likelyObjection: true,
        evidenceSummary: true,
        intelligenceEstablishmentId: true,
      },
    }),
    prisma.outreachEvent.count({
      where: { createdAt: { gte: startOfDay }, type: "CALL" },
    }),
    fetchReviewLeads(),
  ]);

  return (
    <WorkMode
      initialReviewLeads={reviewLeads}
      initialCallLeads={callLeads}
      clearedToday={clearedToday}
    />
  );
}

async function fetchReviewLeads(): Promise<Lead[]> {
  try {
    const response = await leadBotFetch("/review/leads?min_tier=B&limit=40");
    if (!response.ok) return [];
    return (await response.json()) as Lead[];
  } catch {
    return [];
  }
}
