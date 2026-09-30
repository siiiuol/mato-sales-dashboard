import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseUnifiEvent } from "@/lib/camera-events";
import { readSettingSecret } from "@/lib/settings-secrets";

export const dynamic = "force-dynamic";

/**
 * Publiek eindpunt voor de UniFi Protect Alarm Manager-webhook.
 *
 * Beveiligd met een gedeeld geheim als query-param `secret` — Alarm Manager laat
 * geen aangepaste headers toe, wel een vrije URL. Het geheim staat bij
 * Instellingen, zodat het te draaien is zonder nieuwe deploy. Antwoordt altijd
 * 200 bij een geldig geheim, ook als het lichaam niet te ontleden is: UniFi
 * herhaalt een mislukte aflevering, en een halfverwerkte gebeurtenis is nuttiger
 * dan een eindeloze retry-lus.
 */
export async function POST(request: Request) {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: { unifiWebhookSecret: true },
  });

  let secret = "";
  try {
    secret = readSettingSecret(settings?.unifiWebhookSecret);
  } catch {
    // Onleesbaar geheim (SESSION_SECRET gewijzigd) telt als niet ingesteld.
    secret = "";
  }

  if (!secret) {
    return NextResponse.json(
      { error: "De camerakoppeling is nog niet ingesteld." },
      { status: 503 }
    );
  }

  const provided = new URL(request.url).searchParams.get("secret");
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  }

  const raw = await request.text();
  let json: unknown = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    // Bewust geen 400: we bewaren de ruwe tekst hieronder en kijken later wat
    // UniFi precies stuurde.
  }

  const parsed = parseUnifiEvent(json);
  await prisma.cameraEvent.create({
    data: {
      cameraName: parsed.cameraName,
      cameraId: parsed.cameraId,
      eventType: parsed.eventType,
      occurredAt: parsed.occurredAt,
      raw: raw || "{}",
    },
  });

  return NextResponse.json({ ok: true });
}
