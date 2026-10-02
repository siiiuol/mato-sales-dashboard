import "server-only";

/**
 * Ontleedt de UniFi-webhookpayload.
 *
 * Het exacte formaat van de Alarm Manager-webhook is niet gedocumenteerd, dus
 * dit probeert een aantal aannemelijke padnamen en valt terug op null — nooit
 * een crash op een onverwacht veld. Zodra een echte testpayload binnenkomt kan
 * dit verfijnd worden aan de hand van `raw` in CameraEvent.
 */
export function parseUnifiEvent(body: unknown): {
  cameraName: string | null;
  cameraId: string | null;
  eventType: string;
  occurredAt: Date | null;
} {
  const record = isRecord(body) ? body : {};
  const trigger = isRecord(record.trigger) ? record.trigger : record;
  const device = isRecord(trigger.device) ? trigger.device : trigger;

  const cameraName = firstString(
    device.name,
    trigger.deviceName,
    trigger.cameraName,
    record.deviceName,
    record.cameraName,
    // `device` kan ook rechtstreeks de naam zijn in plaats van een object —
    // zo komt hij binnen als de melding de naam in de query-string meestuurt.
    trigger.device,
    record.device,
    trigger.camera,
    record.camera
  );
  const cameraId = firstString(
    device.id,
    trigger.deviceId,
    trigger.cameraId,
    record.deviceId,
    record.cameraId
  );
  const eventType =
    firstString(
      trigger.eventType,
      trigger.type,
      record.eventType,
      record.type
    ) || "person";

  const occurredAt = firstDate(
    trigger.timestamp,
    trigger.eventLocalTime,
    record.timestamp,
    record.eventLocalTime
  );

  return { cameraName, cameraId, eventType, occurredAt };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function firstDate(...values: unknown[]): Date | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      // UniFi stuurt epoch-milliseconden.
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
    if (typeof value === "string" && value.trim()) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  return null;
}

export type DailyFootfall = { date: string; label: string; count: number };

/**
 * Groepeert events per dag (Europe/Brussels) voor de laatste `days` dagen.
 *
 * Het dagetiket wordt hier al opgemaakt en niet in de component: `toLocaleDateString`
 * op de client valt anders uit dan op de server (andere tijdzone of locale), en dat
 * levert een hydration-mismatch op.
 */
export function footfallByDay(
  events: Array<{ occurredAt: Date | null; receivedAt: Date }>,
  days: number
): DailyFootfall[] {
  const buckets = new Map<string, { label: string; count: number }>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    buckets.set(dayKey(d), { label: dayLabel(d), count: 0 });
  }
  for (const event of events) {
    const key = dayKey(event.occurredAt ?? event.receivedAt);
    const bucket = buckets.get(key);
    if (bucket) bucket.count += 1;
  }
  return [...buckets.entries()].map(([date, bucket]) => ({ date, ...bucket }));
}

/** Telt events per camera, aflopend gesorteerd. */
export function footfallByCamera(
  events: Array<{ cameraName: string | null }>
): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const event of events) {
    const label = event.cameraName?.trim() || "Onbekende camera";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function dayKey(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: "Europe/Brussels" });
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString("nl-BE", {
    timeZone: "Europe/Brussels",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
