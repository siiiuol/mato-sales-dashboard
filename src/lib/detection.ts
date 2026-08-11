import type { PrismaClient } from "@prisma/client";
import {
  categoryLabel,
  DEFAULT_DETECTION_CATEGORIES,
  ZONE_TOWNS,
} from "./constants";
import {
  applyVendingSignals,
  scanZoneCandidates,
  vendingMachines,
  type OsmCandidate,
} from "./osm";

export const CATEGORY_WEIGHT: Record<string, number> = {
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
    return [...DEFAULT_DETECTION_CATEGORIES];
  }
}

/**
 * Categorieën die zelf verpakken: bereide gerechten, porties, schaaltjes.
 *
 * MATO verkoopt niet alleen automaten maar ook verpakking en
 * verpakkingsmachines. Deze zaken zijn daarvoor de eerste gesprekken, ook als
 * een automaat nog niet aan de orde is.
 */
const PACKAGING_FIT = new Set([
  "traiteur",
  "butcher",
  "slagerij",
  "farm shop",
  "hoevewinkel",
  "cheese",
  "takeaway",
]);

export type LeadSignalInput = {
  category: string;
  phone?: string | null;
  reviewCount?: number;
  hasVending?: boolean;
  /** Automaten in de buurt die niet van deze zaak zijn. */
  nearbyVending?: number;
  sellsTakeaway?: boolean;
};

export type ScoredSignal = { label: string; points: number };

/**
 * Gewichten op één plek, zodat de score navertelbaar blijft.
 *
 * Vroeger stond dit als één optelsom door de functie heen en was "waarom is dit
 * een 87?" niet te beantwoorden. Nu levert `scoreLead` de losse signalen mee.
 */
export const SCORE_WEIGHTS = {
  /** Bellen is het hele werk; een nummer weegt daarom zwaarder dan wat ook. */
  phone: 25,
  /** Bewezen koper: vervanging of een tweede automaat. */
  hasVending: 20,
  /** Per automaat van een buur, tot een plafond. */
  nearbyVendingEach: 6,
  nearbyVendingMax: 18,
  /** Portioneert en verpakt al voor onderweg. */
  takeaway: 8,
  /** Kandidaat voor de verpakkingslijn, los van automaten. */
  packaging: 5,
  sizeMax: 20,
  /** Iedereen begint boven nul; een lead is pas een lead als je kunt bellen. */
  base: 10,
} as const;

/**
 * Weegt één zaak, en vertelt waarom.
 *
 * Het net staat bewust wijd open: er wordt niets weggegooid op grond van
 * categorie, alleen anders gewogen. Wie te streng filtert houdt een korte lijst
 * over die er goed uitziet en mist de zaak die net niet in het hokje paste.
 */
export function scoreLead(input: LeadSignalInput): {
  score: number;
  reason: string;
  signals: ScoredSignal[];
} {
  const signals: ScoredSignal[] = [];

  const base = CATEGORY_WEIGHT[input.category] ?? 15;
  signals.push({ label: categoryLabel(input.category), points: base });

  if (input.hasVending) {
    signals.push({ label: "heeft al een automaat", points: SCORE_WEIGHTS.hasVending });
  }

  const neighbours = Math.max(0, input.nearbyVending ?? 0);
  if (neighbours > 0) {
    const points = Math.min(
      SCORE_WEIGHTS.nearbyVendingMax,
      neighbours * SCORE_WEIGHTS.nearbyVendingEach
    );
    signals.push({
      label:
        neighbours === 1
          ? "buur heeft al een automaat"
          : `${neighbours} automaten in de buurt`,
      points,
    });
  }

  if (input.sellsTakeaway) {
    signals.push({ label: "verkoopt afhaal", points: SCORE_WEIGHTS.takeaway });
  }

  if (PACKAGING_FIT.has(input.category)) {
    signals.push({ label: "ook voor verpakking", points: SCORE_WEIGHTS.packaging });
  }

  signals.push({
    label: input.phone ? "telefoon bekend" : "geen telefoon",
    points: input.phone ? SCORE_WEIGHTS.phone : 0,
  });

  const sizeBonus = Math.min(
    SCORE_WEIGHTS.sizeMax,
    Math.floor((input.reviewCount ?? 0) / 5)
  );
  if (sizeBonus > 0) {
    signals.push({ label: "grotere zaak", points: sizeBonus });
  }

  const total = signals.reduce((sum, signal) => sum + signal.points, 0);
  const score = Math.min(99, total + SCORE_WEIGHTS.base);

  return { score, reason: signals.map((s) => s.label).join(" · "), signals };
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
  bakery: ["bakery", "pastry_shop"],
  bakkerij: ["bakery", "pastry_shop"],
  patisserie: ["pastry_shop", "dessert_shop"],
  chocolatier: ["chocolate_shop", "candy_store"],
  "ice cream": ["ice_cream_shop"],
  ijssalon: ["ice_cream_shop"],
  butcher: ["butcher_shop"],
  slagerij: ["butcher_shop"],
  traiteur: ["deli"],
  cheese: ["deli"],
  "farm shop": ["deli"],
  hoevewinkel: ["deli"],
  takeaway: ["meal_takeaway"],
  cafe: ["cafe"],
  convenience: ["convenience_store"],
};

/**
 * Each request is capped at 20 results, so asking for everything at once
 * silently loses the smaller categories. Splitting into groups gives each its
 * own 20 slots — the difference between finding four ice-cream shops in a
 * province and finding them in every town.
 */
const PLACES_GROUPS: string[][] = [
  ["bakery", "pastry_shop"],
  ["ice_cream_shop", "candy_store", "chocolate_shop", "dessert_shop"],
  ["butcher_shop", "deli"],
  ["meal_takeaway", "cafe", "convenience_store"],
];

/**
 * Types Google rejects outright — a single one of these makes the whole
 * request fail with INVALID_ARGUMENT, so the group builder filters against
 * this verified list rather than trusting the category map.
 */
const VALID_PLACES_TYPES = new Set([
  "bakery",
  "pastry_shop",
  "ice_cream_shop",
  "candy_store",
  "chocolate_shop",
  "dessert_shop",
  "butcher_shop",
  "deli",
  "meal_takeaway",
  "cafe",
  "convenience_store",
]);

export class PlacesConfigError extends Error {}

async function placesCandidates(
  zone: string,
  categories: string[],
  apiKey: string
): Promise<OsmCandidate[]> {
  const towns = ZONE_TOWNS[zone] ?? [];
  if (!towns.length) return [];

  const wanted = new Set(
    categories
      .flatMap((c) => PLACES_TYPES[c.toLowerCase()] ?? [])
      .filter((t) => VALID_PLACES_TYPES.has(t))
  );
  if (!wanted.size) wanted.add("bakery");

  const groups = PLACES_GROUPS.map((g) => g.filter((t) => wanted.has(t))).filter(
    (g) => g.length > 0
  );

  const seen = new Set<string>();
  const results: OsmCandidate[] = [];

  for (const town of towns) {
    for (const group of groups) {
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
        // Primary type, not just "has this type" — otherwise every Delhaize and
        // Carrefour with an in-store bakery counts as a bakery and crowds out
        // the independent shops that actually buy vending machines.
        includedPrimaryTypes: group,
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
          `Google Places weigert de sleutel (${body.error?.status ?? res.status}). ` +
            `Schakel "Places API (New)" in voor dit project in Google Cloud Console, ` +
            `zet facturatie aan en controleer de API-beperkingen van de sleutel. ` +
            `Maak het sleutelveld leeg bij Instellingen om terug te vallen op gratis OpenStreetMap.`
        );
      }
      throw new PlacesConfigError(
        `Google Places-aanvraag mislukt (${res.status}): ${body.error?.message ?? "onbekende fout"}`
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
        // Google's primaire type is het enige afhaalsignaal dat hier te halen
        // valt; een los `takeaway`-veld zoals in OpenStreetMap bestaat niet.
        sellsTakeaway: place.primaryType === "meal_takeaway",
        nearbyVending: 0,
      });
    }
    }
  }

  // Google has no vending-machine data; OpenStreetMap does, and it is free.
  // Cross-referencing keeps the "already a vending customer" signal even on
  // the paid path.
  await flagVendingFromOsm(zone, results);

  return results;
}

/**
 * Zet de automaatsignalen op de resultaten van de betaalde zoekweg.
 *
 * Google kent geen automaten, OpenStreetMap wel en gratis. Dezelfde functie als
 * de gratis weg gebruikt, zodat een lead dezelfde score krijgt ongeacht waar
 * hij vandaan kwam.
 */
async function flagVendingFromOsm(zone: string, candidates: OsmCandidate[]) {
  try {
    applyVendingSignals(candidates, await vendingMachines(zone));
  } catch {
    // Optional enrichment — never fail a paid scan because OSM was busy.
  }
}

function placesCategory(primaryType?: string): string {
  switch (primaryType) {
    case "bakery":
      return "bakery";
    case "pastry_shop":
    case "dessert_shop":
      return "patisserie";
    case "ice_cream_shop":
      return "ice cream";
    case "candy_store":
    case "chocolate_shop":
      return "chocolatier";
    case "butcher_shop":
      return "butcher";
    case "deli":
      return "traiteur";
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
        coverage = `Google Places · ${ZONE_TOWNS[zone]?.length ?? 0} gemeenten`;
      } catch (err) {
        // A broken key must not mean "no leads today" — fall back to the free
        // source and say plainly why.
        placesProblem = err instanceof Error ? err.message : "Google Places is mislukt";
      }
    }

    if (!usedGoogle) {
      const scan = await scanZoneCandidates(zone, categories);
      candidates = scan.candidates;
      coverage = `${scan.townsOk} van ${scan.townsTotal} gemeenten doorzocht`;
      if (scan.townsFailed.length) {
        // OpenStreetMap's public servers throttle, so a scan often covers only
        // part of a province. Scanning again fills the gaps — results dedupe.
        coverage += ` · OpenStreetMap was bezet voor ${scan.townsFailed.join(", ")} — zoek opnieuw om die mee te nemen`;
      }
    }
    if (placesProblem) {
      coverage = `${placesProblem} — in plaats daarvan OpenStreetMap doorzocht · ${coverage}`;
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

      const hasVending = Boolean(c.hasVending);
      const { score, reason } = scoreLead({
        category: c.category,
        phone: c.phone,
        reviewCount: c.reviewCount,
        hasVending,
        nearbyVending: c.nearbyVending,
        sellsTakeaway: c.sellsTakeaway,
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
          vendingDetail: c.vendingDetail ?? null,
          nearbyVending: c.nearbyVending ?? 0,
          sellsTakeaway: Boolean(c.sellsTakeaway),
          // Bewaard, niet alleen gebruikt: zonder dit verdwijnt "grotere zaak"
          // bij de eerstvolgende herberekening en zakt de score ongemerkt.
          reviewCount: c.reviewCount ?? 0,
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
