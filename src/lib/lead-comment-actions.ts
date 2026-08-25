"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { formObject, idSchema } from "./validation";

export type LeadCommentState = {
  error?: string;
  ok?: boolean;
  savedId?: string;
};

/**
 * Interne teamchat op een lead — wijzigt status of eigenaarschap niet.
 */
export async function postLeadComment(
  _previous: LeadCommentState,
  formData: FormData
): Promise<LeadCommentState> {
  try {
    const user = await requireUser(["admin", "sales"]);
    const parsed = z
      .object({
        leadId: idSchema,
        body: z.string().trim().min(1).max(4000),
      })
      .safeParse(formObject(formData));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Controleer de tekst" };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: parsed.data.leadId },
      select: {
        id: true,
        ownerId: true,
        owner: { select: { name: true } },
      },
    });
    if (!lead) return { error: "Lead niet gevonden" };
    if (lead.ownerId && lead.ownerId !== user.id && user.role !== "admin") {
      return {
        error: `Deze lead staat op naam van ${lead.owner?.name ?? "een collega"}`,
      };
    }

    const comment = await prisma.leadComment.create({
      data: {
        leadId: lead.id,
        authorId: user.id,
        body: parsed.data.body,
      },
      select: { id: true },
    });

    await audit(user.id, "lead.comment_posted", "lead", lead.id, {
      commentId: comment.id,
    });

    revalidatePath(`/leads/${lead.id}`);
    revalidatePath("/");
    return { ok: true, savedId: comment.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Bericht kon niet worden bewaard",
    };
  }
}
