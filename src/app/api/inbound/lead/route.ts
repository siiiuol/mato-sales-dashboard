import { NextResponse } from "next/server";
import { z } from "zod";
import { processInboundSubmission } from "@/lib/inbound-actions";

export const dynamic = "force-dynamic";

/**
 * Publiek eindpunt voor website-aanvragen.
 *
 * Beveiligd met INBOUND_LEAD_SECRET in header `x-mato-inbound-secret`.
 * Zonder die env-var weigeren we alles (geen open deur per ongeluk).
 */

const bodySchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  company: z.string().trim().max(200).optional().or(z.literal("")),
  sourceDetail: z.string().trim().max(200).optional().or(z.literal("")),
});

const recentByIp = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 20;
  const stamps = (recentByIp.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (stamps.length >= max) {
    recentByIp.set(ip, stamps);
    return true;
  }
  stamps.push(now);
  recentByIp.set(ip, stamps);
  return false;
}

export async function POST(request: Request) {
  const secret = process.env.INBOUND_LEAD_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "INBOUND_LEAD_SECRET ontbreekt." },
      { status: 503 }
    );
  }

  const provided = request.headers.get("x-mato-inbound-secret");
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  }

  const ip =
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Te veel aanvragen." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ongeldige velden.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (!parsed.data.email && !parsed.data.phone) {
    return NextResponse.json(
      { error: "E-mail of telefoon is verplicht." },
      { status: 400 }
    );
  }

  const result = await processInboundSubmission({
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    city: parsed.data.city || null,
    address: parsed.data.address || null,
    message: parsed.data.message || null,
    company: parsed.data.company || null,
    sourceDetail: parsed.data.sourceDetail || null,
  });

  return NextResponse.json({
    ok: true,
    submissionId: result.submissionId,
    status: result.status,
    leadId: result.leadId,
    reason: result.reason,
  });
}
