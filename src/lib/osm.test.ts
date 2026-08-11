import test from "node:test";
import assert from "node:assert/strict";
import {
  boxAround,
  countNearbyVending,
  queryPlan,
  sellsTakeaway,
  tagsForCategories,
  __testing,
} from "./osm";
import { ZONE_TOWNS } from "./constants";

const { categoryForTags, unionFor, bboxStr } = __testing;

test("a town box surrounds its centre and has real extent", () => {
  const [south, west, north, east] = boxAround(50.9447, 3.1338, 7);
  assert.ok(south < 50.9447 && north > 50.9447);
  assert.ok(west < 3.1338 && east > 3.1338);
  // 7 km is roughly 0.063 degrees of latitude.
  assert.ok(Math.abs(north - south - 0.126) < 0.02);
});

test("Roeselare is scanned — the bug that lost De Zoete Zonde", () => {
  const towns = ZONE_TOWNS["West-Vlaanderen"].map((t) => t.name);
  assert.ok(towns.includes("Roeselare"));
  // Every town is scanned, not just the first one.
  assert.ok(towns.length > 1);
});

test("a lead's town box actually contains the lead", () => {
  const roeselare = ZONE_TOWNS["West-Vlaanderen"].find((t) => t.name === "Roeselare")!;
  const [south, west, north, east] = boxAround(roeselare.lat, roeselare.lng, 7);
  // De Zoete Zonde, Vlamingstraat — found by the live scan at these coordinates.
  const shop = { lat: 50.9236, lng: 3.2064 };
  assert.ok(shop.lat > south && shop.lat < north);
  assert.ok(shop.lng > west && shop.lng < east);
});

test("categories collapse to one regex per OSM key", () => {
  const groups = tagsForCategories(["bakery", "patisserie", "ice cream"]);
  const shop = groups.find(([k]) => k === "shop");
  assert.ok(shop);
  assert.ok(shop![1].includes("bakery"));
  assert.ok(shop![1].includes("pastry"));
  assert.ok(shop![1].includes("ice_cream"));

  const ql = unionFor(groups, "50,3,51,4");
  // One statement per key, not one per value.
  assert.equal(ql.split("nwr").length - 1, groups.length);
  assert.match(ql, /\^\(/);
});

test("an unknown category never produces an empty scan", () => {
  const groups = tagsForCategories(["not-a-category"]);
  assert.ok(groups.length > 0);
});

test("ice cream and confectionery map to real categories", () => {
  // shop=ice_cream was absent from the old tag list, which is why an
  // ice-cream shop in Roeselare could never be found.
  assert.equal(categoryForTags({ shop: "ice_cream" }, "bakery"), "ice cream");
  assert.equal(categoryForTags({ shop: "confectionery" }, "bakery"), "patisserie");
  assert.equal(categoryForTags({ shop: "chocolate" }, "bakery"), "chocolatier");
  assert.equal(categoryForTags({ amenity: "cafe" }, "bakery"), "cafe");
  assert.equal(categoryForTags({}, "bakery"), "bakery");
});

test("bbox is rendered in Overpass order with fixed precision", () => {
  assert.equal(bboxStr([50.7, 2.5, 51.4, 3.55]), "50.7000,2.5000,51.4000,3.5500");
});

test("busy categories get their own query so they cannot evict the specialists", () => {
  // Dit was de fout: alle categorieën in één vraag met één plafond, waarna 368
  // frituren de 8 patisserieën eruit duwden.
  const plan = queryPlan(["bakery", "patisserie", "takeaway"]);
  assert.equal(plan.length, 2, "specialists and high-volume must be separated");

  const specialists = plan[0];
  const busy = plan[1];
  assert.ok(busy.cap < specialists.cap, "the busy class needs the smaller cap");

  const busyKeys = busy.pairs.flatMap(([, values]) => values);
  assert.ok(busyKeys.includes("fast_food"));
  const specialistKeys = specialists.pairs.flatMap(([, values]) => values);
  assert.ok(specialistKeys.includes("bakery"));
  assert.ok(!specialistKeys.includes("fast_food"));
});

test("the usual selection still costs one query per town", () => {
  // Geen extra Overpass-belasting zolang er geen talrijke categorie gevraagd is.
  const plan = queryPlan(["bakery", "patisserie", "butcher"]);
  assert.equal(plan.length, 1);
});

test("asking for nothing still scans for something", () => {
  assert.ok(queryPlan([]).length > 0);
});

test("a shop's own machine is not counted as competition", () => {
  // Zonder deze uitsluiting krijgt elke zaak mét automaat er gratis een
  // concurrentiescore bij en meet het signaal zichzelf.
  const shop = { lat: 50.9236, lng: 3.2064 };
  const ownMachine = { lat: 50.9236, lng: 3.2064, operator: null, vending: "bread" };
  assert.equal(countNearbyVending(shop, [ownMachine]), 0);
});

test("machines around the corner are counted, machines across the province are not", () => {
  const shop = { lat: 50.9236, lng: 3.2064 };
  const machines = [
    { lat: 50.9265, lng: 3.2064, operator: null, vending: "bread" }, // ~320 m
    { lat: 50.9326, lng: 3.2064, operator: null, vending: "milk" }, // ~1.0 km
    { lat: 51.2093, lng: 3.2247, operator: null, vending: "bread" }, // Brugge
  ];
  assert.equal(countNearbyVending(shop, machines), 2);
});

test("takeaway is read from the tag, and an explicit no is respected", () => {
  assert.equal(sellsTakeaway({ shop: "bakery", takeaway: "yes" }), true);
  assert.equal(sellsTakeaway({ shop: "bakery", takeaway: "only" }), true);
  // Een uitdrukkelijk "nee" van de kaartenmaker is geen ontbrekend gegeven.
  assert.equal(sellsTakeaway({ amenity: "fast_food", takeaway: "no" }), false);
  assert.equal(sellsTakeaway({ amenity: "fast_food" }), true);
  assert.equal(sellsTakeaway({ shop: "bakery" }), false);
});
