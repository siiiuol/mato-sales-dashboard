const PLACES_BASE = "https://places.googleapis.com/v1";
const PLACES_TIMEOUT_MS = 12_000;

type FetchLike = typeof fetch;

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  editorialSummary?: { text?: string };
};

export type PlacesProfile = {
  source: "details" | "search";
  placeId: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  mapsUrl: string | null;
  type: string | null;
  typeLabel: string | null;
  businessStatus: string | null;
  rating: number | null;
  reviewCount: number;
  openingHours: string | null;
  editorialSummary: string | null;
};

export type PlacesLeadLookup = {
  name: string;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  placeId?: string | null;
};

export class PlacesProfileError extends Error {}

export function googlePlaceId(value?: string | null): string | null {
  const id = value?.startsWith("places:") ? value.slice("places:".length).trim() : "";
  return id && !id.includes("/") ? id : null;
}

function normalizePlace(place: GooglePlace, source: PlacesProfile["source"]): PlacesProfile | null {
  const id = place.id?.trim();
  if (!id) return null;
  const descriptions = place.regularOpeningHours?.weekdayDescriptions
    ?.map((description) => description.trim())
    .filter(Boolean);
  return {
    source,
    placeId: `places:${id}`,
    name: place.displayName?.text?.trim() || null,
    address: place.formattedAddress?.trim() || null,
    phone:
      place.nationalPhoneNumber?.trim() ||
      place.internationalPhoneNumber?.trim() ||
      null,
    website: place.websiteUri?.trim() || null,
    mapsUrl: place.googleMapsUri?.trim() || null,
    type: place.primaryType?.trim() || null,
    typeLabel: place.primaryTypeDisplayName?.text?.trim() || null,
    businessStatus: place.businessStatus?.trim() || null,
    rating:
      typeof place.rating === "number" && Number.isFinite(place.rating)
        ? place.rating
        : null,
    reviewCount:
      typeof place.userRatingCount === "number" &&
      Number.isInteger(place.userRatingCount) &&
      place.userRatingCount >= 0
        ? place.userRatingCount
        : 0,
    openingHours: descriptions?.length ? descriptions.join("\n") : null,
    editorialSummary: place.editorialSummary?.text?.trim() || null,
  };
}

async function placesRequest(
  url: string,
  init: RequestInit,
  apiKey: string,
  fetchImpl: FetchLike
): Promise<Response> {
  if (!apiKey.trim()) {
    throw new PlacesProfileError(
      "Er is nog geen Google Places-sleutel ingesteld. Vul die in bij Instellingen."
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(url, {
      ...init,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "X-Goog-Api-Key": apiKey.trim(),
        ...init.headers,
      },
      signal: AbortSignal.timeout(PLACES_TIMEOUT_MS),
    });
  } catch {
    throw new PlacesProfileError("Google Places is momenteel niet bereikbaar.");
  }

  if (!response.ok && response.status !== 404) {
    const detail = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; status?: string };
    };
    if (response.status === 401 || response.status === 403) {
      throw new PlacesProfileError(
        "Google Places weigert de sleutel. Controleer Places API (New) bij Instellingen."
      );
    }
    if (response.status === 429) {
      throw new PlacesProfileError(
        "Google Places kreeg te veel aanvragen na elkaar. Probeer het straks opnieuw."
      );
    }
    throw new PlacesProfileError(
      `Google Places gaf een fout (${response.status}): ${
        detail.error?.message ?? "onbekende reden"
      }`
    );
  }
  return response;
}

const DETAIL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "primaryType",
  "primaryTypeDisplayName",
  "businessStatus",
  "rating",
  "userRatingCount",
  "regularOpeningHours",
  "editorialSummary",
].join(",");

async function fetchDetails(
  id: string,
  apiKey: string,
  fetchImpl: FetchLike
): Promise<PlacesProfile | null> {
  const url = new URL(`${PLACES_BASE}/places/${encodeURIComponent(id)}`);
  url.searchParams.set("languageCode", "nl");
  url.searchParams.set("regionCode", "BE");
  const response = await placesRequest(
    url.toString(),
    {
      method: "GET",
      headers: { "X-Goog-FieldMask": DETAIL_FIELDS },
    },
    apiKey,
    fetchImpl
  );
  if (response.status === 404) return null;
  return normalizePlace((await response.json()) as GooglePlace, "details");
}

async function searchPlace(
  lead: PlacesLeadLookup,
  apiKey: string,
  fetchImpl: FetchLike
): Promise<PlacesProfile | null> {
  const query = [lead.name, lead.address, lead.city, lead.province, "België"]
    .filter(Boolean)
    .join(", ")
    .slice(0, 500);
  const response = await placesRequest(
    `${PLACES_BASE}/places:searchText`,
    {
      method: "POST",
      headers: {
        "X-Goog-FieldMask": DETAIL_FIELDS.split(",")
          .map((field) => `places.${field}`)
          .join(","),
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize: 1,
        languageCode: "nl",
        regionCode: "BE",
      }),
    },
    apiKey,
    fetchImpl
  );
  if (response.status === 404) return null;
  const data = (await response.json()) as { places?: GooglePlace[] };
  return data.places?.[0] ? normalizePlace(data.places[0], "search") : null;
}

/**
 * Eén expliciete profielactie doet maximaal één detailaanvraag of, als het
 * Google-ID ontbreekt/verouderd is, één tekstzoekopdracht.
 */
export async function fetchPlacesProfile(
  lead: PlacesLeadLookup,
  apiKey: string,
  fetchImpl: FetchLike = fetch
): Promise<PlacesProfile | null> {
  const id = googlePlaceId(lead.placeId);
  if (id) {
    const details = await fetchDetails(id, apiKey, fetchImpl);
    if (details) return details;
  }
  return searchPlace(lead, apiKey, fetchImpl);
}
