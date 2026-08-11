import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, requireUser } from "@/lib/dal";
import { workableByMe } from "@/lib/claims";

export async function GET() {
  try {
    const user = await requireUser(["admin", "sales", "reviewer"]);
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const leads = await prisma.lead.findMany({
      where: {
        doNotContact: false,
        complianceStatus: "CLEARED",
        status: { in: ["NEW", "TO_CALL", "FOLLOW_UP", "CONTACTED"] },
        AND: [
          { OR: [{ nextActionAt: { lte: endOfDay } }, { nextActionAt: null }] },
          // Dezelfde uitsluiting als de wachtrij op de startpagina; die twee
          // moeten het eens zijn, anders duikt een lead van een collega na het
          // verversen alsnog op.
          ...workableByMe(user.id, now),
        ],
      },
      orderBy: [
        { hasVending: "desc" },
        { score: "desc" },
        { timingScore: "desc" },
        { lastTouchedAt: "asc" },
      ],
      take: 20,
      select: {
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
      },
    });

    return NextResponse.json(leads);
  } catch (error) {
    return apiError(error);
  }
}
