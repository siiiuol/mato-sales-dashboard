import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, audit, requireUser } from "@/lib/dal";
import { sendLearningOutcomeSafely } from "@/lib/learning";
import { callOutcomeSchema, formObject, idSchema } from "@/lib/validation";
import type { LeadStatus } from "@/lib/types";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const optionalId = z.string().cuid().optional().or(z.literal(""));

export async function POST(request: Request) {
  try {
    const user = await requireUser(["admin", "sales", "reviewer"]);
    const formData = await request.formData();
    const parsed = z
      .object({
        leadId: idSchema,
        outcome: callOutcomeSchema,
        note: z.string().trim().max(2000).optional(),
        callbackAt: z.string().optional(),
        nextLeadId: optionalId,
      })
      .parse(formObject(formData));

    const lead = await prisma.lead.findUnique({
      where: { id: parsed.leadId },
      select: {
        doNotContact: true,
        complianceStatus: true,
        intelligenceEstablishmentId: true,
        intelligenceEnterpriseId: true,
        tier: true,
      },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (lead.doNotContact || lead.complianceStatus === "BLOCKED") {
      return NextResponse.json({ error: "Compliance block" }, { status: 403 });
    }

    const nextFollowUpAt =
      parsed.outcome === "CALLBACK" && parsed.callbackAt
        ? new Date(parsed.callbackAt)
        : null;

    let status: LeadStatus = "CONTACTED";
    if (parsed.outcome === "INTERESTED") status = "NEGOTIATION";
    if (parsed.outcome === "NOT_INTERESTED") status = "LOST";
    if (
      parsed.outcome === "CALLBACK" ||
      parsed.outcome === "VOICEMAIL" ||
      parsed.outcome === "NO_ANSWER"
    ) {
      status = "FOLLOW_UP";
    }
    if (parsed.outcome === "WRONG_NUMBER") status = "DO_NOT_CONTACT";

    const outreach = await prisma.outreachEvent.create({
      data: {
        leadId: parsed.leadId,
        type: "CALL",
        outcome: parsed.outcome,
        note: parsed.note || null,
        nextFollowUpAt: nextFollowUpAt ?? undefined,
        createdById: user.id,
      },
    });

    await prisma.lead.update({
      where: { id: parsed.leadId },
      data: {
        status,
        nextActionAt:
          nextFollowUpAt ??
          (status === "FOLLOW_UP" ? new Date(Date.now() + 86400000) : null),
        lastTouchedAt: new Date(),
      },
    });
    await audit(user.id, "call.logged", "lead", parsed.leadId, {
      outcome: parsed.outcome,
    });

    if (lead.intelligenceEstablishmentId) {
      await sendLearningOutcomeSafely({
        idempotency_key: `outreach:${outreach.id}`,
        intelligence_establishment_id: lead.intelligenceEstablishmentId,
        enterprise_number: lead.intelligenceEnterpriseId,
        outcome_type: "outreach",
        outcome_value: parsed.outcome.toLowerCase(),
        occurred_at: outreach.createdAt.toISOString(),
        cohort: lead.tier,
      });
    }

    revalidatePath("/");
    revalidatePath("/calls");
    revalidatePath("/leads");

    return NextResponse.json({
      ok: true,
      nextLeadId: parsed.nextLeadId || null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid call log" }, { status: 400 });
    }
    return apiError(error);
  }
}
