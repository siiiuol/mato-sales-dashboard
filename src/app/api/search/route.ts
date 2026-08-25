import { NextResponse } from "next/server";
import { apiError, requireUser } from "@/lib/dal";
import { searchEverything } from "@/lib/search";

export async function GET(request: Request) {
  try {
    await requireUser(["admin", "sales", "reviewer"]);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const hits = await searchEverything(q, 24);
    return NextResponse.json({ q, hits });
  } catch (e) {
    return apiError(e);
  }
}
