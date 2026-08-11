import test from "node:test";
import assert from "node:assert/strict";
import { boxAround, boundingBoxFilter, haversineKm, withinRadius } from "./geo";

const ROESELARE = { lat: 50.9447, lng: 3.1338 };
const KORTRIJK = { lat: 50.8279, lng: 3.2649 };

test("distance between two known towns is about right", () => {
  // Roeselare–Kortrijk is hemelsbreed ongeveer 17 km.
  const km = haversineKm(ROESELARE, KORTRIJK);
  assert.ok(km > 15 && km < 19, `verwachtte ~17 km, kreeg ${km}`);
});

test("distance to yourself is zero", () => {
  assert.equal(haversineKm(ROESELARE, ROESELARE), 0);
});

test("distance is symmetric", () => {
  assert.equal(
    haversineKm(ROESELARE, KORTRIJK).toFixed(6),
    haversineKm(KORTRIJK, ROESELARE).toFixed(6)
  );
});

test("the box is wider in longitude than in latitude at Belgian latitudes", () => {
  // Op 51° noord is een graad lengte nog maar ~70 km. Zonder die correctie is
  // de rechthoek in België ruim anderhalf keer te breed.
  const [south, west, north, east] = boxAround(51, 3, 10);
  const latSpan = north - south;
  const lngSpan = east - west;
  assert.ok(lngSpan > latSpan, "longitude span must be corrected for latitude");
});

test("the bounding box always contains the circle", () => {
  // Dit is waar de grove voorselectie op steunt: als de rechthoek smaller zou
  // zijn dan de cirkel, vielen er zaken weg die wél binnen de straal liggen.
  const radius = 12;
  const [south, west, north, east] = boxAround(ROESELARE.lat, ROESELARE.lng, radius);
  for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const rad = (bearing * Math.PI) / 180;
    const dLat = (radius / 111) * Math.cos(rad);
    const dLng =
      (radius / (111 * Math.cos((ROESELARE.lat * Math.PI) / 180))) * Math.sin(rad);
    const edge = { lat: ROESELARE.lat + dLat, lng: ROESELARE.lng + dLng };
    assert.ok(
      edge.lat >= south && edge.lat <= north && edge.lng >= west && edge.lng <= east,
      `point at ${bearing}° fell outside the box`
    );
  }
});

test("the Prisma filter reads as a range on both axes", () => {
  const filter = boundingBoxFilter(ROESELARE, 5);
  assert.ok(filter.lat.gte < ROESELARE.lat && filter.lat.lte > ROESELARE.lat);
  assert.ok(filter.lng.gte < ROESELARE.lng && filter.lng.lte > ROESELARE.lng);
});

test("the radius refine keeps the near and drops the far", () => {
  assert.equal(withinRadius(ROESELARE, KORTRIJK, 20), true);
  assert.equal(withinRadius(ROESELARE, KORTRIJK, 10), false);
});

test("a lead without coordinates is never inside a radius", () => {
  // Anders zou een zaak zonder locatie in elke straalzoekopdracht opduiken.
  assert.equal(withinRadius(ROESELARE, { lat: null, lng: null }, 500), false);
});
