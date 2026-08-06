import { apiError, requireUser } from "@/lib/dal";
import { leadBotFetch } from "@/lib/lead-bot";
import { z } from "zod";

const establishmentId = z.coerce.number().int().positive();

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser(["admin", "sales", "reviewer"]);
    const id = establishmentId.parse((await context.params).id);
    const response = await leadBotFetch(`/review/leads/${id}`);
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid establishment id" }, { status: 400 });
    }
    return apiError(error);
  }
}
