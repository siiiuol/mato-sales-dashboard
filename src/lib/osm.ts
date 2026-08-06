import { ZONE_BBOX, ZONE_TOWNS } from "./constants";

/**
 * Lead discovery over OpenStreetMap via Overpass.
 *
 * Overpass is the only source. Nominatim used to be primary here, which was
 * wrong twice over: it is a geocoder rather than a POI search, and it returns
 * no contact details — in a tool built for phoning people, that produced rows
 * nobody could call.
 *
 * Queries are tiled over the province bounding box. A whole province in one
 * request reliably times out (observed 504 from both mirrors); the tile size
 * below is close to one measured to work.
 */

const OVERPASS_ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

/** Half-width of the box scanned around each town centre, in km. */
const TOWN_RADIUS_KM = 7;
/**
 * Tiles fetched at once. Overpass mirrors are slow and fail often, so running
 * tiles strictly one after another spends the whole budget on a handful of
 * them — a sequential run covered 5 of 16 tiles before timing out. Kept low
 * out of politeness, and spread across mirrors.
 */
const CONCURRENCY = 2;
/** Per-request client timeout. Server-side timeout is set lower in the QL. */
const REQUEST_TIMEOUT_MS = 45_000;
/**
 * Whole-scan budget. A human clicked a button and is waiting, so partial
 * coverage returned promptly beats complete coverage that never arrives.
 */
const SCAN_BUDGET_MS = 240_000;

/**
 * MATO category → OSM tags.
 *
 * Vending prospects are any business selling physical product a customer
 * collects, so this deliberately reaches past classic "shops" into ice cream,
 * takeaway and cafes — De Zoete Zonde in Roeselare is `shop=ice_cream`, and
 * the old seven-tag list could never have found it.
 */
const CATEGORY_TAGS: Record<string, Array<[string, string]>> = {
  bakery: [["shop", "bakery"]],
  bakkerij: [["shop", "bakery"]],
  patisserie: [
    ["shop", "pastry"],
    ["shop", "confectionery"],
  ],
  butcher: [["shop", "butcher"]],
  slagerij: [["shop", "butcher"]],
  chocolatier: [
    ["shop", "chocolate"],
    ["shop", "confectionery"],
  ],
  "ice cream": [
    ["shop", "ice_cream"],
    ["amenity", "ice_cream"],
  ],
  ijssalon: [
    ["shop", "ice_cream"],
    ["amenity", "ice_cream"],
  ],
  traiteur: [["shop", "deli"]],
  cheese: [["shop", "cheese"]],
  "farm shop": [
    ["shop", "farm"],
    ["shop", "greengrocer"],
  ],
  hoevewinkel: [["shop", "farm"]],
  florist: [["shop", "florist"]],
  takeaway: [["amenity", "fast_food"]],
  restaurant: [["amenity", "restaurant"]],
  cafe: [["amenity", "cafe"]],
  convenience: [["shop", "convenience"]],
};

/**
 * Default scan set: businesses that sell physical product a customer collects.
 *
 * Restaurants and cafes are deliberately excluded. They are weak vending
 * prospects and there are an order of magnitude more of them — including them
 * flooded the per-tile result cap and evicted the specialist shops that matter
 * (a scan returned 368 takeaways against 8 patisseries, and lost a real
 * ice-cream shop in Roeselare as a result). They remain selectable in Settings.
 */
const DEFAULT_CATEGORIES = [
  "bakery",
  "patisserie",
  "butcher",
  "chocolatier",
  "ice cream",
  "traiteur",
  "cheese",
  "farm shop",
];

/** vending=* values worth hunting — these signal food/drink retail automation. */
const VENDING_VALUES = [
  "bread",
  "milk",
  "food",
  "eggs",
  "cheese",
  "farm_produce",
  "drinks",
  "ice_cream",
  "pizza",
  "potatoes",
  "fruit",
  "vegetables",
];

export type OsmCandidate = {
  name: string;
  address: string | null;
  city: string | null;
  province: string;
  lat: number;
  lng: number;
  category: string;
  phone: string | null;
  website: string | null;
  mapsUrl: string;
  placeId: string;
  reviewCount: number;
  hasVending: boolean;
  vendingDetail: string | null;
};

type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

/**
 * Runs one Overpass query, trying every mirror before giving up.
 * Overpass returns 429/502/504 routinely under load, so a single attempt
 * against a single endpoint — which is what this used to do — fails often.
 */
async function overpassQuery(ql: string, startAt = 0): Promise<OverpassElement[]> {
  let lastError: unknown;
  // Rotate which mirror is tried first so concurrent tiles spread the load.
  const endpoints = OVERPASS_ENDPOINTS.map(
    (_, i) => OVERPASS_ENDPOINTS[(startAt + i) % OVERPASS_ENDPOINTS.length]
  );
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          accept: "application/json",
          "user-agent": "MATO-Dashboard/1.0 (local lead discovery)",
        },
        body: new URLSearchParams({ data: ql }).toString(),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        lastError = new Error(`Overpass ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { elements?: OverpassElement[] };
      return data.elements ?? [];
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("Overpass unavailable");
}

/**
 * Groups the requested categories into one entry per OSM key.
 *
 * Emitting `nwr["shop"="bakery"]; nwr["shop"="pastry"]; …` makes Overpass run a
 * separate lookup per line, which is what pushed tiles into 504s. One regex
 * per key is a single lookup and is dramatically cheaper.
 */
export function tagsForCategories(categories: string[]): Array<[string, string[]]> {
  const byKey = new Map<string, Set<string>>();
  for (const category of categories) {
    const tags = CATEGORY_TAGS[category.toLowerCase()];
    if (!tags) continue;
    for (const [key, value] of tags) {
      if (!byKey.has(key)) byKey.set(key, new Set());
      byKey.get(key)!.add(value);
    }
  }
  // Never scan for nothing.
  if (byKey.size === 0) byKey.set("shop", new Set(["bakery"]));
  return [...byKey.entries()].map(([key, values]) => [key, [...values]]);
}

function unionFor(groups: Array<[string, string[]]>, bbox: string) {
  return groups
    .map(([key, values]) =>
      values.length === 1
        ? `  nwr["${key}"="${values[0]}"](${bbox});`
        : `  nwr["${key}"~"^(${values.join("|")})$"](${bbox});`
    )
    .join("\n");
}

/** Bounding box of `radiusKm` around a point, as [south, west, north, east]. */
export function boxAround(
  lat: number,
  lng: number,
  radiusKm: number
): [number, number, number, number] {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return [lat - dLat, lng - dLng, lat + dLat, lng + dLng];
}

function bboxStr(b: [number, number, number, number]) {
  return b.map((n) => n.toFixed(4)).join(",");
}

function categoryForTags(tags: Record<string, string>, fallback: string): string {
  const shop = (tags.shop || "").toLowerCase();
  const amenity = (tags.amenity || "").toLowerCase();
  if (shop === "bakery") return "bakery";
  if (shop === "pastry") return "patisserie";
  if (shop === "confectionery") return "patisserie";
  if (shop === "chocolate") return "chocolatier";
  if (shop === "ice_cream" || amenity === "ice_cream") return "ice cream";
  if (shop === "butcher") return "butcher";
  if (shop === "deli") return "traiteur";
  if (shop === "cheese") return "cheese";
  if (shop === "farm" || shop === "greengrocer") return "farm shop";
  if (shop === "florist") return "florist";
  if (shop === "convenience") return "convenience";
  if (amenity === "fast_food" || amenity === "restaurant") return "takeaway";
  if (amenity === "cafe") return "cafe";
  return fallback;
}

function normalizeElement(
  el: OverpassElement,
  zone: string,
  fallbackCategory: string
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
  // Never guess the city. Falling back to the province's main town labelled
  // shops all over West-Vlaanderen as "Brugge" — actively misleading when you
  // are about to phone them and mention where they are.
  const city = tags["addr:city"] || tags["addr:municipality"] || tags["addr:suburb"] || null;
  const address = [`${street} ${housenumber}`.trim(), postcode, city]
    .filter(Boolean)
    .join(" ");

  let website = tags.website || tags["contact:website"] || tags.url || null;
  if (website && !website.startsWith("http")) website = `https://${website}`;

  const phone = tags.phone || tags["contact:phone"] || tags.telephone || null;

  return {
    name,
    address: address || null,
    city,
    province: zone,
    lat,
    lng,
    category: categoryForTags(tags, fallbackCategory),
    phone,
    website,
    mapsUrl: `https://www.openstreetmap.org/${el.type || "node"}/${el.id}`,
    placeId: `osm:${el.type || "node"}/${el.id}`,
    reviewCount: 0,
    hasVending: false,
    vendingDetail: null,
  };
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type VendingPoint = {
  lat: number;
  lng: number;
  operator: string | null;
  vending: string | null;
};

/**
 * Businesses already running a vending machine are the strongest prospects —
 * proven buyers, and candidates for replacement or a second site. OSM maps
 * these as `amenity=vending_machine`, and the machine's `operator` tag usually
 * names the business to call.
 */
export async function vendingMachines(zone: string): Promise<VendingPoint[]> {
  const bbox = ZONE_BBOX[zone];
  if (!bbox) return [];
  const ql = `[out:json][timeout:45];
(
  nwr["amenity"="vending_machine"]["vending"~"^(${VENDING_VALUES.join("|")})$"](${bboxStr(bbox)});
);
out center 500;`;
  try {
    const elements = await overpassQuery(ql);
    const points: VendingPoint[] = [];
    for (const el of elements) {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat == null || lng == null) continue;
      points.push({
        lat,
        lng,
        operator: el.tags?.operator || el.tags?.brand || el.tags?.name || null,
        vending: el.tags?.vending || null,
      });
    }
    return points;
  } catch {
    return [];
  }
}

function describeVending(v: VendingPoint) {
  const kind = v.vending ? v.vending.replaceAll("_", " ") : "vending";
  return v.operator
    ? `${kind} machine on site (operator: ${v.operator})`
    : `${kind} machine on site`;
}

export type ScanResult = {
  candidates: OsmCandidate[];
  townsTotal: number;
  townsOk: number;
  townsFailed: string[];
};

/**
 * Free province-wide scan over Overpass, tiled to stay inside query limits.
 *
 * Reports tile coverage so a partial scan can say so honestly rather than
 * looking like a province with very few bakeries in it.
 */
export async function scanZoneCandidates(
  zone: string,
  categories: string[],
  townNames?: string[]
): Promise<ScanResult> {
  const allTowns = ZONE_TOWNS[zone] ?? [];
  const towns = townNames?.length
    ? allTowns.filter((t) => townNames.includes(t.name))
    : allTowns;
  if (!towns.length) {
    return { candidates: [], townsTotal: 0, townsOk: 0, townsFailed: [] };
  }

  const cats = categories.length ? categories : DEFAULT_CATEGORIES;
  const pairs = tagsForCategories(cats);
  const fallbackCategory = cats[0] ?? "bakery";

  const seen = new Set<string>();
  const results: OsmCandidate[] = [];
  const deadline = Date.now() + SCAN_BUDGET_MS;
  let townsOk = 0;
  let townsFailed: string[] = [];
  let cursor = 0;
  let queue: typeof towns = [];

  async function worker(workerIndex: number) {
    for (;;) {
      const index = cursor++;
      if (index >= queue.length) return;
      if (Date.now() > deadline) return;
      const town = queue[index];
      const box = boxAround(town.lat, town.lng, TOWN_RADIUS_KM);
      const union = unionFor(pairs, bboxStr(box));
      const ql = `[out:json][timeout:45];\n(\n${union}\n);\nout center 1000;`;
      try {
        const elements = await overpassQuery(ql, workerIndex);
        townsOk++;
        for (const el of elements) {
          const candidate = normalizeElement(el, zone, fallbackCategory);
          if (!candidate || seen.has(candidate.placeId)) continue;
          // Towns overlap; keep the first town that found it as a hint only.
          if (!candidate.city) candidate.city = town.name;
          seen.add(candidate.placeId);
          results.push(candidate);
        }
      } catch {
        // A dead town costs coverage, not the whole scan.
        townsFailed.push(town.name);
      }
    }
  }

  async function runPass(batch: typeof towns) {
    queue = batch;
    cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, batch.length) }, (_, i) => worker(i))
    );
  }

  await runPass(towns);

  // Overpass rejects when its slots are busy. Towns that lost that race usually
  // succeed on a second, quieter pass.
  if (townsFailed.length && Date.now() < deadline) {
    const retryNames = new Set(townsFailed);
    townsFailed = [];
    await runPass(towns.filter((t) => retryNames.has(t.name)));
  }

  // Nothing came back at all — surface that rather than reporting an empty
  // province, which would look like "there are no bakeries in West-Vlaanderen".
  if (townsOk === 0) {
    throw new Error("Overpass unavailable — no results returned");
  }

  // Flag businesses that already run a machine.
  const machines = await vendingMachines(zone);
  if (machines.length) {
    for (const candidate of results) {
      const near = machines.find(
        (m) => haversineKm(candidate, m) <= 0.05 // ~50 m: same premises
      );
      if (near) {
        candidate.hasVending = true;
        candidate.vendingDetail = describeVending(near);
      }
    }
  }

  return {
    candidates: results,
    townsTotal: towns.length,
    townsOk,
    townsFailed,
  };
}

/** Back-compatible shape for callers that only want the businesses. */
export async function osmCandidates(
  zone: string,
  categories: string[]
): Promise<OsmCandidate[]> {
  const { candidates } = await scanZoneCandidates(zone, categories);
  return candidates;
}

export const __testing = { tagsForCategories, categoryForTags, bboxStr, unionFor };
