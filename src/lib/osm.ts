import { ZONE_BBOX, ZONE_CENTERS } from "./constants";

const OVERPASS_ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

const CATEGORY_TAGS: Record<string, Array<[string, string]>> = {
  bakery: [["shop", "bakery"]],
  bakkerij: [["shop", "bakery"]],
  butcher: [["shop", "butcher"]],
  slagerij: [["shop", "butcher"]],
  patisserie: [
    ["shop", "pastry"],
    ["shop", "bakery"],
  ],
  traiteur: [["shop", "deli"]],
  chocolatier: [
    ["shop", "chocolate"],
    ["shop", "confectionery"],
  ],
  florist: [["shop", "florist"]],
  "farm shop": [["shop", "farm"]],
  hoevewinkel: [["shop", "farm"]],
};

export type OsmCandidate = {
  name: string;
  address: string | null;
  city: string;
  province: string;
  lat: number;
  lng: number;
  category: string;
  phone: string | null;
  website: string | null;
  mapsUrl: string;
  placeId: string;
  reviewCount: number;
};

function tagsForCategory(category: string): Array<[string, string]> {
  const key = category.toLowerCase();
  return CATEGORY_TAGS[key] ?? [["shop", "bakery"]];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function overpassQuery(ql: string): Promise<unknown[]> {
  let lastError: unknown;
  // One short attempt per endpoint — Overpass is often blocked/slow; Nominatim is primary.
  for (const endpoint of OVERPASS_ENDPOINTS.slice(0, 1)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          accept: "application/json",
          "user-agent": "MATO-Dashboard/1.0 (local lead discovery)",
        },
        body: new URLSearchParams({ data: ql }).toString(),
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`Overpass ${res.status}`);
        continue;
      }
      if (!res.ok) {
        lastError = new Error(`Overpass ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { elements?: unknown[] };
      return data.elements ?? [];
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) throw lastError;
  return [];
}

function normalizeElement(
  el: {
    type?: string;
    id?: number;
    lat?: number;
    lon?: number;
    center?: { lat?: number; lon?: number };
    tags?: Record<string, string>;
  },
  zone: string,
  category: string,
  fallbackCity?: string
): OsmCandidate | null {
  const tags = el.tags || {};
  const name = tags.name || tags.brand || tags.operator;
  if (!name) return null;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;

  const street = tags["addr:street"] || "";
  const housenumber = tags["addr:housenumber"] || "";
  const postcode = tags["addr:postcode"] || "";
  const city =
    tags["addr:city"] ||
    tags["addr:municipality"] ||
    fallbackCity ||
    ZONE_CENTERS[zone]?.cities[0] ||
    zone;
  const address = [(`${street} ${housenumber}`).trim(), postcode, city]
    .filter(Boolean)
    .join(" ");

  let website = tags.website || tags["contact:website"] || tags.url || null;
  if (website && !website.startsWith("http")) website = `https://${website}`;

  const phone = tags.phone || tags["contact:phone"] || tags.telephone || null;
  const placeId = `osm:${el.type || "node"}/${el.id}`;

  return {
    name,
    address: address || null,
    city,
    province: zone,
    lat,
    lng,
    category,
    phone,
    website,
    mapsUrl: `https://www.openstreetmap.org/${el.type || "node"}/${el.id}`,
    placeId,
    reviewCount: 0,
  };
}

function categoryForTags(tags: Record<string, string>, fallback: string): string {
  const shop = (tags.shop || "").toLowerCase();
  if (shop === "bakery" || shop === "pastry") return "bakery";
  if (shop === "butcher") return "butcher";
  if (shop === "chocolate" || shop === "confectionery") return "chocolatier";
  if (shop === "deli") return "traiteur";
  if (shop === "florist") return "florist";
  if (shop === "farm") return "farm shop";
  return fallback;
}

async function nominatimSearch(
  zone: string,
  categories: string[]
): Promise<OsmCandidate[]> {
  const center = ZONE_CENTERS[zone];
  if (!center) return [];
  const results: OsmCandidate[] = [];
  const seen = new Set<string>();
  const primaryCity = center.cities[0];
  const queries = [
    ...categories.slice(0, 3).map((c) => `${c} ${primaryCity} Belgium`),
    `bakkerij ${primaryCity}`,
    `slagerij ${primaryCity}`,
  ];

  for (const q of [...new Set(queries)].slice(0, 4)) {
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", q);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "15");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("countrycodes", "be");
      const res = await fetch(url.toString(), {
        headers: {
          accept: "application/json",
          "user-agent": "MATO-Dashboard/1.0 (local lead discovery)",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const rows = (await res.json()) as Array<{
        osm_type?: string;
        osm_id?: number;
        display_name?: string;
        name?: string;
        lat?: string;
        lon?: string;
        type?: string;
        address?: { city?: string; town?: string; municipality?: string };
      }>;
      for (const row of rows) {
        const lat = Number(row.lat);
        const lng = Number(row.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !row.osm_id) continue;
        const placeId = `osm:${row.osm_type || "node"}/${row.osm_id}`;
        if (seen.has(placeId)) continue;
        seen.add(placeId);
        const name =
          row.name ||
          (row.display_name ? row.display_name.split(",")[0]?.trim() : "") ||
          "Unknown";
        const city =
          row.address?.city ||
          row.address?.town ||
          row.address?.municipality ||
          primaryCity;
        const category =
          (row.type || "").includes("butcher") || q.toLowerCase().includes("slagerij")
            ? "butcher"
            : categories[0] || "bakery";
        results.push({
          name,
          address: row.display_name || null,
          city,
          province: zone,
          lat,
          lng,
          category,
          phone: null,
          website: null,
          mapsUrl: `https://www.openstreetmap.org/${row.osm_type || "node"}/${row.osm_id}`,
          placeId,
          reviewCount: 0,
        });
      }
    } catch {
      // try next query
    }
    await sleep(1100);
  }
  return results;
}

async function overpassEnrich(
  zone: string,
  categories: string[]
): Promise<OsmCandidate[]> {
  const center = ZONE_CENTERS[zone];
  const bbox = ZONE_BBOX[zone];
  if (!center && !bbox) return [];

  const cats = categories.length ? categories.slice(0, 4) : ["bakery", "butcher"];
  const tagPairs = new Map<string, [string, string]>();
  for (const category of cats) {
    for (const pair of tagsForCategory(category)) {
      tagPairs.set(`${pair[0]}=${pair[1]}`, pair);
    }
  }
  tagPairs.set("shop=bakery", ["shop", "bakery"]);
  tagPairs.set("shop=butcher", ["shop", "butcher"]);

  const lat = center?.lat ?? (bbox ? (bbox[0] + bbox[2]) / 2 : 0);
  const lng = center?.lng ?? (bbox ? (bbox[1] + bbox[3]) / 2 : 0);
  const city = center?.cities[0] ?? zone;

  const union = [...tagPairs.values()]
    .map(([k, v]) => `  nwr["${k}"="${v}"](around:8000,${lat},${lng});`)
    .join("\n");
  const ql = `
[out:json][timeout:8];
(
${union}
);
out center 30;
`;

  const elements = (await overpassQuery(ql)) as Array<{
    type?: string;
    id?: number;
    lat?: number;
    lon?: number;
    center?: { lat?: number; lon?: number };
    tags?: Record<string, string>;
  }>;

  const results: OsmCandidate[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    const category = categoryForTags(el.tags || {}, cats[0] || "bakery");
    const candidate = normalizeElement(el, zone, category, city);
    if (!candidate || seen.has(candidate.placeId)) continue;
    seen.add(candidate.placeId);
    results.push(candidate);
  }
  return results;
}

/** Free zone scan via Nominatim (primary) + optional Overpass enrich. */
export async function osmCandidates(
  zone: string,
  categories: string[]
): Promise<OsmCandidate[]> {
  const center = ZONE_CENTERS[zone];
  const bbox = ZONE_BBOX[zone];
  if (!center && !bbox) return [];

  const cats = categories.length
    ? categories.slice(0, 4)
    : ["bakery", "butcher", "patisserie"];

  const seen = new Set<string>();
  const results: OsmCandidate[] = [];

  // Nominatim first — reliable when Overpass mirrors time out or are blocked.
  const fromNominatim = await nominatimSearch(zone, cats);
  for (const candidate of fromNominatim) {
    if (seen.has(candidate.placeId)) continue;
    seen.add(candidate.placeId);
    results.push(candidate);
  }

  // Only hit Overpass when Nominatim returned nothing (avoid long hangs).
  if (results.length === 0) {
    try {
      const fromOverpass = await overpassEnrich(zone, cats);
      for (const candidate of fromOverpass) {
        if (seen.has(candidate.placeId)) continue;
        seen.add(candidate.placeId);
        results.push(candidate);
      }
    } catch {
      // both sources empty / failed
    }
  }

  return results;
}
