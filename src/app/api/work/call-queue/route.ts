import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, requireUser } from "@/lib/dal";

export async function GET() {
  try {
    await requireUser(["admin", "sales", "reviewer"]);
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const leads = await prisma.lead.findMany({
      where: {
        doNotContact: false,
        complianceStatus: "CLEARED",
        status: { in: ["NEW", "TO_CALL", "FOLLOW_UP", "CONTACTED"] },
        OR: [{ nextActionAt: { lte: endOfDay } }, { nextActionAt: null }],
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
    });

    return NextResponse.json(leads);
  } catch (error) {
    return apiError(error);
  }
}
