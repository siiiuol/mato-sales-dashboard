import { apiError, requireUser } from "@/lib/dal";
import { leadBotFetch } from "@/lib/lead-bot";

export async function GET(request: Request) {
  try {
    await requireUser(["admin", "sales", "reviewer"]);
    const query = new URL(request.url).searchParams;
    const minTier = query.get("min_tier") || "B";
    const limit = Math.min(100, Math.max(1, Number(query.get("limit") || 80)));

    let response: Response;
    try {
      response = await leadBotFetch(
        `/review/leads?min_tier=${encodeURIComponent(minTier)}&limit=${limit}`
      );
    } catch {
      // Lead-bot is an optional companion service; an empty queue is the
      // correct answer when it is unreachable, not a server error.
      return Response.json([], { headers: { "x-lead-bot": "offline" } });
    }
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    return apiError(error);
  }
}
