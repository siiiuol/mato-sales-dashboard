import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, requireUser } from "@/lib/dal";
import {
  buildCallQueueWhere,
  CALL_QUEUE_ORDER,
  CALL_QUEUE_SELECT,
} from "@/lib/call-queue";

export async function GET() {
  try {
    const user = await requireUser(["admin", "sales", "reviewer"]);
    const now = new Date();

    const leads = await prisma.lead.findMany({
      where: buildCallQueueWhere(user.id, now),
      orderBy: [...CALL_QUEUE_ORDER],
      take: 20,
      select: CALL_QUEUE_SELECT,
    });

    return NextResponse.json(leads);
  } catch (error) {
    return apiError(error);
  }
}
