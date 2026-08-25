import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchPlacesProfile,
  googlePlaceId,
  PlacesProfileError,
} from "./places-profile";

test("only Google-backed lead ids become Place ids", () => {
  assert.equal(googlePlaceId("places:ChIJ123"), "ChIJ123");
  assert.equal(googlePlaceId("osm:node/12"), null);
  assert.equal(googlePlaceId("places:"), null);
  assert.equal(googlePlaceId("places:bad/id"), null);
});

test("Place Details is normalized for an existing Google lead", async () => {
  let requested = "";
  let mask = "";
  const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
    requested = String(input);
    mask = new Headers(init?.headers).get("X-Goog-FieldMask") ?? "";
    return Response.json({
      id: "ChIJ123",
      displayName: { text: "Bakkerij Test" },
      formattedAddress: "Markt 1, 8600 Diksmuide",
      nationalPhoneNumber: "051 00 00 00",
      websiteUri: "https://bakkerij-test.be",
      googleMapsUri: "https://maps.google.com/test",
      primaryTypeDisplayName: { text: "Bakkerij" },
      businessStatus: "OPERATIONAL",
      rating: 4.6,
      userRatingCount: 83,
      regularOpeningHours: {
        weekdayDescriptions: ["maandag: 07:00–18:00", "dinsdag: 07:00–18:00"],
      },
      editorialSummary: { text: "Lokale bakkerij." },
    });
  };

  const result = await fetchPlacesProfile(
    { name: "Bakkerij Test", placeId: "places:ChIJ123" },
    "test-key",
    fakeFetch as typeof fetch
  );
  assert.match(requested, /\/places\/ChIJ123/);
  assert.match(mask, /regularOpeningHours/);
  assert.equal(result?.source, "details");
  assert.equal(result?.phone, "051 00 00 00");
  assert.equal(result?.rating, 4.6);
  assert.equal(result?.reviewCount, 83);
  assert.match(result?.openingHours ?? "", /dinsdag/);
});

test("an OSM lead uses one targeted Places text search", async () => {
  let requestBody = "";
  const fakeFetch = async (_input: string | URL | Request, init?: RequestInit) => {
    requestBody = String(init?.body ?? "");
    return Response.json({
      places: [
        {
          id: "ChIJOSM",
          displayName: { text: "Hoevewinkel Test" },
          primaryTypeDisplayName: { text: "Hoevewinkel" },
          userRatingCount: 12,
        },
      ],
    });
  };
  const result = await fetchPlacesProfile(
    {
      name: "Hoevewinkel Test",
      address: "Dorpstraat 4",
      city: "Diksmuide",
      province: "West-Vlaanderen",
      placeId: "osm:way/42",
    },
    "test-key",
    fakeFetch as typeof fetch
  );
  assert.match(requestBody, /Hoevewinkel Test/);
  assert.match(requestBody, /Diksmuide/);
  assert.equal(result?.source, "search");
  assert.equal(result?.placeId, "places:ChIJOSM");
});

test("Places configuration failures become a clear domain error", async () => {
  const fakeFetch = async () =>
    Response.json(
      { error: { message: "forbidden" } },
      { status: 403 }
    );
  await assert.rejects(
    () =>
      fetchPlacesProfile(
        { name: "Test", placeId: "places:ChIJ123" },
        "bad-key",
        fakeFetch as typeof fetch
      ),
    PlacesProfileError
  );
});
