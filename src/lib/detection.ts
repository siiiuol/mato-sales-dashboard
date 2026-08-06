import type { PrismaClient } from "@prisma/client";
import { ZONE_CENTERS } from "./constants";
import { scanZoneCandidates, type OsmCandidate } from "./osm";

const CATEGORY_WEIGHT: Record<string, number> = {
  bakery: 34,
  bakkerij: 34,
  butcher: 30,
  slagerij: 30,
  patisserie: 32,
  traiteur: 30,
  chocolatier: 28,
  "ice cream": 30,
  ijssalon: 30,
  cheese: 26,
  florist: 24,
  "farm shop": 26,
  hoevewinkel: 26,
  takeaway: 24,
  cafe: 18,
  convenience: 20,
  factory: 18,
  warehouse: 16,
  gym: 14,
  office: 12,
  hotel: 12,
  school: 10,
  hospital: 10,
};

type SettingsLike = {
  placesApiKey: string;
  detectionCategories: string;
  exclusionRadiusKm: number;
};

function parseCategories(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [
      "bakery",
      "patisserie",
      "butcher",
      "chocolatier",
      "ice cream",
      "traiteur",
      "cheese",
      "farm shop",
    ];
  }
}

export function scoreLead(input: {
  category: string;
  phone?: string | null;
  reviewCount?: number;
  hasVending?: boolean;
}): { score: number; reason: string } {
  const base = CATEGORY_WEIGHT[input.category] ?? 15;
  // A number you can dial is worth more than any other signal in a calling tool.
  const phoneBonus = input.phone ? 25 : 0;
  const sizeBonus = Math.min(20, Math.floor((input.reviewCount ?? 0) / 5));
  // Already running a machine means proven demand — a replacement or second-site
  // prospect, not a competitor to avoid.
  const vendingBonus = input.hasVending ? 20 : 0;
  const score = Math.min(99, base + phoneBonus + sizeBonus + vendingBonus + 10);
  const bits = [
    input.category.charAt(0).toUpperCase() + input.category.slice(1),
    input.hasVending ? "already has vending" : null,
    input.phone ? "phone available" : "no phone",
    sizeBonus > 0 ? "size proxy" : null,
  ].filter(Boolean);
  return { score, reason: bits.join(" · ") };
}

/**
 * Should this candidate be skipped because we already sell there?
 * Pure so the arithmetic is testable — over-suppressing silently costs leads.
 */
export function isExcluded(
  candidate: { name: string; lat?: number | null; lng?: number | null },
  wonNames: Set<string>,
  wonPoints: Array<{ lat: number; lng: number }>,
  radiusKm: number
): boolean {
  if (wonNames.has(candidate.name.trim().toLowerCase())) return true;
  if (candidate.lat == null || candidate.lng == null) return false;
  const at = { lat: candidate.lat, lng: candidate.lng };
  return wonPoints.some((p) => haversineKm(at, p) < radiusKm);
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function placesCandidates(
  zone: string,
  categories: string[],
  apiKey: string
) {
  const center = ZONE_CENTERS[zone];
  if (!center) return [];

  const results: OsmCandidate[] = [];
  // Nearby Search — one query per category for the zone center
  for (const category of categories.slice(0, 4)) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", `${center.lat},${center.lng}`);
    url.searchParams.set("radius", "25000");
    url.searchParams.set("keyword", category);
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) continue;
    const data = (await res.json()) as {
      results?: Array<{
        place_id: string;
        name: string;
        vicinity?: string;
        geometry?: { location?: { lat: number; lng: number } };
        rating?: number;
        user_ratings_total?: number;
        types?: string[];
      }>;
    };

    for (const place of data.results ?? []) {
      const lat = place.geometry?.location?.lat;
      const lng = place.geometry?.location?.lng;
      if (!lat || !lng || !place.place_id) continue;

      // Detail for phone
      let phone: string | null = null;
      let website: string | null = null;
      try {
        const detailUrl = new URL(
          "https://maps.googleapis.com/maps/api/place/details/json"
        );
        detailUrl.searchParams.set("place_id", place.place_id);
        detailUrl.searchParams.set("fields", "formatted_phone_number,website,url");
        detailUrl.searchParams.set("key", apiKey);
        const detailRes = await fetch(detailUrl.toString());
        if (detailRes.ok) {
          const detail = (await detailRes.json()) as {
            result?: {
              formatted_phone_number?: string;
              website?: string;
              url?: string;
            };
          };
          phone = detail.result?.formatted_phone_number ?? null;
          website = detail.result?.website ?? null;
        }
      } catch {
        // ignore detail failures
      }

      results.push({
        name: place.name,
        address: place.vicinity ?? null,
        city: center.cities[0],
        province: zone,
        lat,
        lng,
        category,
        phone,
        website,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=place_id:${place.place_id}`,
        placeId: place.place_id,
        reviewCount: place.user_ratings_total ?? 0,
      } as never);
    }
  }

  return results;
}

export async function runDetection(
  prisma: PrismaClient,
  zone: string,
  settings: SettingsLike
) {
  const run = await prisma.detectionRun.create({
    data: { zone, status: "running" },
  });

  try {
    const categories = parseCategories(settings.detectionCategories);
    const useGoogle = Boolean(settings.placesApiKey?.trim());
    let candidates: OsmCandidate[];
    let coverage = "";
    if (useGoogle) {
      candidates = (await placesCandidates(
        zone,
        categories,
        settings.placesApiKey.trim()
      )) as OsmCandidate[];
    } else {
      const scan = await scanZoneCandidates(zone, categories);
      candidates = scan.candidates;
      coverage = `${scan.townsOk}/${scan.townsTotal} towns covered`;
      if (scan.townsFailed.length) {
        // OpenStreetMap's public servers throttle, so a scan often covers only
        // part of a province. Scanning again fills the gaps — results dedupe.
        coverage += ` · OpenStreetMap was busy for ${scan.townsFailed.join(", ")} — scan again to cover them`;
      }
    }
    const source = useGoogle ? "places" : "openstreetmap";

    // Places we already sell to. A lead marked WON is the record of that —
    // there is no separate customer list any more.
    const wonLeads = await prisma.lead.findMany({
      where: { status: "WON" },
      select: { name: true, lat: true, lng: true },
    });
    const wonNames = new Set(wonLeads.map((l) => l.name.trim().toLowerCase()));
    const wonPoints = wonLeads
      .filter((l): l is typeof l & { lat: number; lng: number } =>
        l.lat != null && l.lng != null
      )
      .map((l) => ({ lat: l.lat, lng: l.lng }));

    let created = 0;
    let skipped = 0;

    for (const c of candidates) {
      if (!c.placeId) {
        skipped++;
        continue;
      }

      const existing = await prisma.lead.findUnique({ where: { placeId: c.placeId } });
      if (existing) {
        skipped++;
        continue;
      }

      if (isExcluded(c, wonNames, wonPoints, settings.exclusionRadiusKm)) {
        skipped++;
        continue;
      }

      const hasVending = "hasVending" in c ? Boolean(c.hasVending) : false;
      const { score, reason } = scoreLead({
        category: c.category,
        phone: c.phone,
        reviewCount: "reviewCount" in c ? (c as { reviewCount?: number }).reviewCount : 0,
        hasVending,
      });

      await prisma.lead.create({
        data: {
          name: c.name,
          address: c.address ?? undefined,
          city: c.city ?? undefined,
          province: c.province,
          lat: c.lat ?? undefined,
          lng: c.lng ?? undefined,
          category: c.category,
          phone: c.phone ?? undefined,
          website: c.website ?? undefined,
          mapsUrl: c.mapsUrl ?? undefined,
          placeId: c.placeId,
          source,
          score,
          reason: `${reason} · ${zone}`,
          status: "NEW",
          hasVending,
          vendingDetail:
            "vendingDetail" in c ? ((c as { vendingDetail?: string | null }).vendingDetail ?? null) : null,
        },
      });
      created++;
    }

    await prisma.detectionRun.update({
      where: { id: run.id },
      data: {
        status: "done",
        finishedAt: new Date(),
        createdCount: created,
        skippedCount: skipped,
        detail: useGoogle ? "Google Places scan" : `OpenStreetMap scan · ${coverage}`,
      },
    });

    return { runId: run.id, created, skipped, demo: false, source, coverage };
  } catch (err) {
    await prisma.detectionRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        detail: err instanceof Error ? err.message : "Unknown error",
      },
    });
    throw err;
  }
}
