import type { PrismaClient } from "@prisma/client";
import { ZONE_TOWNS } from "./constants";
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

/**
 * Google Places (New) discovery — the paid, high-coverage alternative to OSM.
 *
 * Uses the same town-by-town sweep as the free path so a whole province is
 * covered rather than one circle around its capital.
 *
 * The legacy `maps.googleapis.com/maps/api/place/*` endpoints this used to call
 * are switched off for projects created after March 2025, so this targets
 * Places API (New).
 */
const PLACES_TYPES: Record<string, string[]> = {
  bakery: ["bakery"],
  bakkerij: ["bakery"],
  patisserie: ["bakery", "candy_store"],
  chocolatier: ["candy_store"],
  "ice cream": ["ice_cream_shop"],
  ijssalon: ["ice_cream_shop"],
  butcher: ["grocery_store"],
  slagerij: ["grocery_store"],
  traiteur: ["meal_takeaway"],
  cheese: ["grocery_store"],
  "farm shop": ["grocery_store"],
  hoevewinkel: ["grocery_store"],
  takeaway: ["meal_takeaway"],
  cafe: ["cafe"],
  convenience: ["convenience_store"],
};

export class PlacesConfigError extends Error {}

async function placesCandidates(
  zone: string,
  categories: string[],
  apiKey: string
): Promise<OsmCandidate[]> {
  const towns = ZONE_TOWNS[zone] ?? [];
  if (!towns.length) return [];

  const types = [
    ...new Set(
      categories.flatMap((c) => PLACES_TYPES[c.toLowerCase()] ?? []).filter(Boolean)
    ),
  ];
  if (!types.length) types.push("bakery");

  const seen = new Set<string>();
  const results: OsmCandidate[] = [];

  for (const town of towns) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.nationalPhoneNumber",
          "places.internationalPhoneNumber",
          "places.websiteUri",
          "places.location",
          "places.primaryType",
          "places.userRatingCount",
          "places.addressComponents",
        ].join(","),
      },
      body: JSON.stringify({
        includedTypes: types,
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: town.lat, longitude: town.lng },
            radius: 7000,
          },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: { status?: string; message?: string };
      };
      // A misconfigured key must never look like "this province has no bakeries".
      if (res.status === 401 || res.status === 403) {
        throw new PlacesConfigError(
          `Google Places rejected the key (${body.error?.status ?? res.status}). ` +
            `Enable "Places API (New)" for this project in Google Cloud Console, ` +
            `make sure billing is on, and check the key's API restrictions. ` +
            `Clear the key in Settings to go back to free OpenStreetMap search.`
        );
      }
      throw new PlacesConfigError(
        `Google Places request failed (${res.status}): ${body.error?.message ?? "unknown error"}`
      );
    }

    const data = (await res.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        nationalPhoneNumber?: string;
        internationalPhoneNumber?: string;
        websiteUri?: string;
        location?: { latitude?: number; longitude?: number };
        primaryType?: string;
        userRatingCount?: number;
        addressComponents?: Array<{ longText?: string; types?: string[] }>;
      }>;
    };

    for (const place of data.places ?? []) {
      const id = place.id;
      const name = place.displayName?.text;
      const lat = place.location?.latitude;
      const lng = place.location?.longitude;
      if (!id || !name || lat == null || lng == null) continue;
      const placeId = `places:${id}`;
      if (seen.has(placeId)) continue;
      seen.add(placeId);

      const locality = place.addressComponents?.find((c) =>
        c.types?.includes("locality")
      )?.longText;

      results.push({
        name,
        address: place.formattedAddress ?? null,
        city: locality ?? town.name,
        province: zone,
        lat,
        lng,
        category: placesCategory(place.primaryType),
        phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
        website: place.websiteUri ?? null,
        mapsUrl: `https://www.google.com/maps/place/?q=place_id:${id}`,
        placeId,
        reviewCount: place.userRatingCount ?? 0,
        hasVending: false,
        vendingDetail: null,
      });
    }
  }

  return results;
}

function placesCategory(primaryType?: string): string {
  switch (primaryType) {
    case "bakery":
      return "bakery";
    case "ice_cream_shop":
      return "ice cream";
    case "candy_store":
      return "chocolatier";
    case "meal_takeaway":
      return "takeaway";
    case "cafe":
      return "cafe";
    case "convenience_store":
      return "convenience";
    default:
      return "bakery";
  }
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
    const wantGoogle = Boolean(settings.placesApiKey?.trim());
    let candidates: OsmCandidate[] = [];
    let coverage = "";
    let usedGoogle = false;
    let placesProblem = "";

    if (wantGoogle) {
      try {
        candidates = await placesCandidates(
          zone,
          categories,
          settings.placesApiKey.trim()
        );
        usedGoogle = true;
        coverage = `Google Places · ${ZONE_TOWNS[zone]?.length ?? 0} towns`;
      } catch (err) {
        // A broken key must not mean "no leads today" — fall back to the free
        // source and say plainly why.
        placesProblem = err instanceof Error ? err.message : "Google Places failed";
      }
    }

    if (!usedGoogle) {
      const scan = await scanZoneCandidates(zone, categories);
      candidates = scan.candidates;
      coverage = `${scan.townsOk}/${scan.townsTotal} towns covered`;
      if (scan.townsFailed.length) {
        // OpenStreetMap's public servers throttle, so a scan often covers only
        // part of a province. Scanning again fills the gaps — results dedupe.
        coverage += ` · OpenStreetMap was busy for ${scan.townsFailed.join(", ")} — scan again to cover them`;
      }
    }
    if (placesProblem) {
      coverage = `${placesProblem} — searched OpenStreetMap instead · ${coverage}`;
    }
    const source = usedGoogle ? "places" : "openstreetmap";

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
        detail: `${usedGoogle ? "Google Places" : "OpenStreetMap"} scan · ${coverage}`,
      },
    });

    return {
      runId: run.id,
      created,
      skipped,
      demo: false,
      source,
      coverage,
      placesProblem: placesProblem || null,
    };
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
