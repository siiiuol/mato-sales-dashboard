import { NextResponse } from "next/server";
import { apiError, requireUser } from "@/lib/dal";
import { logCallForLead } from "@/lib/call-log";
import { callOutcomeSchema, formObject, idSchema } from "@/lib/validation";
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
        lossReason: z
          .enum([
            "NO_INTEREST",
            "TIMING",
            "PRICE",
            "NO_FIT",
            "COMPETITOR",
            "UNREACHABLE",
            "DUPLICATE",
            "OTHER",
          ])
          .optional(),
      })
      .parse(formObject(formData));

    await logCallForLead({
      leadId: parsed.leadId,
      outcome: parsed.outcome,
      note: parsed.note,
      callbackAt: parsed.callbackAt,
      lossReason: parsed.lossReason,
      userId: user.id,
    });

    revalidatePath("/");
    revalidatePath("/leads");
    revalidatePath("/mijn-leads");

    return NextResponse.json({
      ok: true,
      nextLeadId: parsed.nextLeadId || null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid call log" }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("Geblokkeerd")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message.includes("niet gevonden")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return apiError(error);
  }
}
