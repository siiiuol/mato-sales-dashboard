import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { intelligenceImportSchema } from "@/lib/validation";
import { z } from "zod";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-mato-key");
  const expected =
    process.env.LEAD_BOT_API_KEY ||
    (process.env.NODE_ENV !== "production" ? "mato-dev-key" : undefined);
  if (!expected || key !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof intelligenceImportSchema>;
  try {
    body = intelligenceImportSchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid intelligence payload",
        issues: error instanceof z.ZodError ? error.issues : undefined,
      },
      { status: 400 }
    );
  }

  const placeId = `intel-${body.intelligence_establishment_id}`;

  const existing = await prisma.lead.findFirst({
    where: {
      OR: [
        { intelligenceEstablishmentId: body.intelligence_establishment_id },
        { placeId },
        ...(body.phone
          ? [{ phone: body.phone, name: { equals: body.name } }]
          : []),
      ],
    },
  });

  const data = {
    name: body.name,
    address: body.address || null,
    city: body.city || null,
    province: body.province || null,
    lat: typeof body.lat === "number" ? body.lat : null,
    lng: typeof body.lng === "number" ? body.lng : null,
    category: body.category || body.recommended_machine || null,
    phone: body.phone || null,
    email: body.email || null,
    website: body.website || null,
    placeId,
    intelligenceEstablishmentId: body.intelligence_establishment_id,
    intelligenceEnterpriseId:
      body.intelligence_enterprise_id || body.enterprise_number || null,
    establishmentName: body.establishment_name || null,
    enterpriseName: body.enterprise_name || null,
    source: "lead_intelligence",
    sourceVersion: body.source_version || null,
    score: Math.round(body.score),
    timingScore: Math.round(body.timing_score),
    distanceKm: body.distance_km ?? null,
    tier: body.tier || null,
    reason: [body.tier, body.reason, body.recommended_machine]
      .filter(Boolean)
      .join(" · "),
    evidenceSummary: body.evidence_summary || null,
    recommendedMachine: body.recommended_machine || null,
    recommendedAngle: body.recommended_contact_angle || null,
    phoneOpener: body.phone_opener || null,
    discoveryQuestions: body.discovery_questions
      ? JSON.stringify(body.discovery_questions)
      : null,
    likelyObjection: body.likely_objection || null,
    outreachPrep: body.outreach_prep ? JSON.stringify(body.outreach_prep) : null,
    status:
      body.action === "approve_for_call"
        ? "TO_CALL"
        : body.action === "do_not_contact"
          ? "DO_NOT_CONTACT"
          : "NEW",
    nextActionAt: new Date(),
    complianceStatus:
      body.action === "do_not_contact" ? "BLOCKED" : body.compliance_status,
    doNotContact: body.action === "do_not_contact",
    suppressionReason:
      body.action === "do_not_contact" ? "Lead intelligence review" : null,
  };

  const lead = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.lead.update({ where: { id: existing.id }, data })
      : await tx.lead.create({ data });
    if (body.action === "approve_for_email" && body.email) {
      const prep = body.outreach_prep;
      const subject = String(prep?.subject || `MATO opportunity for ${body.name}`);
      const draftBody = String(
        prep?.email_blurb ||
          `Prepared outreach for ${body.name}. Review and edit before any manual send.`
      );
      const alreadyPrepared = await tx.emailDraft.findFirst({
        where: { leadId: saved.id, status: { in: ["PREPARED", "APPROVED"] } },
      });
      if (!alreadyPrepared) {
        await tx.emailDraft.create({
          data: { leadId: saved.id, subject, body: draftBody },
        });
      }
    }
    return saved;
  });

  return NextResponse.json({ ok: true, leadId: lead.id });
}
