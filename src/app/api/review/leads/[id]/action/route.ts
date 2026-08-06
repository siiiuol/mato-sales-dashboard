import { apiError, audit, requireUser } from "@/lib/dal";
import { leadBotFetch } from "@/lib/lead-bot";
import { reviewActionSchema } from "@/lib/validation";
import { z } from "zod";

const establishmentId = z.coerce.number().int().positive();
const bodySchema = z.object({
  action: reviewActionSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Work Mode: every hire reviews then calls
    const user = await requireUser(["admin", "reviewer", "sales"]);
    const id = establishmentId.parse((await context.params).id);
    const body = bodySchema.parse(await request.json());
    const response = await leadBotFetch(`/review/leads/${id}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (response.ok) {
      await audit(user.id, body.action, "intelligence_establishment", String(id));
    }
    return new Response(text, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid review action" }, { status: 400 });
    }
    return apiError(error);
  }
}
