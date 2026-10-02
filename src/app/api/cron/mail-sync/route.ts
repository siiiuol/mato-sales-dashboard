import { NextResponse } from "next/server";
import { syncAllMailboxes } from "@/lib/mail-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron: elke 15 minuten alle gekoppelde postvakken bijwerken.
 *
 * Beveiligd met CRON_SECRET — zonder die header mag niemand de sync aftrappen.
 * Vercel zet `Authorization: Bearer <CRON_SECRET>` automatisch als die env-var
 * bestaat.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET ontbreekt in de omgeving." },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  }

  const summary = await syncAllMailboxes();

  return NextResponse.json({
    ok: true,
    mailboxes: summary.results.length,
    added: summary.added,
    unmatched: summary.unmatched,
    failed: summary.failed,
    errors: summary.errors,
  });
}
