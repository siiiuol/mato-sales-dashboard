import test from "node:test";
import assert from "node:assert/strict";
import { isExcluded, scoreLead } from "./detection";

const NO_NAMES = new Set<string>();
const NO_POINTS: Array<{ lat: number; lng: number }> = [];

test("a candidate matching a won lead by name is excluded", () => {
  const names = new Set(["bakkerij dult"]);
  assert.equal(isExcluded({ name: "Bakkerij Dult" }, names, NO_POINTS, 0.5), true);
  assert.equal(isExcluded({ name: "  BAKKERIJ DULT " }, names, NO_POINTS, 0.5), true);
  assert.equal(isExcluded({ name: "Bakkerij Ander" }, names, NO_POINTS, 0.5), false);
});

test("a candidate inside the exclusion radius is excluded", () => {
  const won = [{ lat: 51.0, lng: 3.7 }];
  // ~150 m away
  const near = { name: "X", lat: 51.0013, lng: 3.7 };
  assert.equal(isExcluded(near, NO_NAMES, won, 0.5), true);
});

test("a candidate outside the exclusion radius is kept", () => {
  const won = [{ lat: 51.0, lng: 3.7 }];
  // ~5 km away
  const far = { name: "X", lat: 51.045, lng: 3.7 };
  assert.equal(isExcluded(far, NO_NAMES, won, 0.5), false);
});

test("a candidate without coordinates is never excluded by proximity", () => {
  const won = [{ lat: 51.0, lng: 3.7 }];
  assert.equal(isExcluded({ name: "X" }, NO_NAMES, won, 50), false);
  assert.equal(
    isExcluded({ name: "X", lat: null, lng: null }, NO_NAMES, won, 50),
    false
  );
});

test("an existing vending machine raises the score rather than lowering it", () => {
  const without = scoreLead({ category: "bakery", phone: "+32 51 20 00 00" });
  const with_ = scoreLead({
    category: "bakery",
    phone: "+32 51 20 00 00",
    hasVending: true,
  });
  assert.ok(with_.score > without.score, "vending should be a positive signal");
  assert.match(with_.reason, /heeft al een automaat/);
});

test("a reachable business outranks an identical one with no phone", () => {
  const reachable = scoreLead({ category: "bakery", phone: "+32 51 20 00 00" });
  const unreachable = scoreLead({ category: "bakery", phone: null });
  assert.ok(reachable.score > unreachable.score);
  assert.match(unreachable.reason, /geen telefoon/);
});

test("a neighbour with a machine raises the score — the FOMO argument", () => {
  const alone = scoreLead({ category: "bakery", phone: "051", nearbyVending: 0 });
  const surrounded = scoreLead({
    category: "bakery",
    phone: "051",
    nearbyVending: 2,
  });
  assert.ok(surrounded.score > alone.score);
  assert.match(surrounded.reason, /2 automaten in de buurt/);
});

test("one neighbour reads as one, not as a plural", () => {
  const one = scoreLead({ category: "bakery", phone: "051", nearbyVending: 1 });
  assert.match(one.reason, /buur heeft al een automaat/);
});

test("a whole street of machines cannot outweigh everything else", () => {
  // Zonder plafond zou één druk winkelcentrum elke zaak erin naar 99 duwen en
  // het onderscheid binnen die straat volledig wegpoetsen.
  const many = scoreLead({ category: "bakery", nearbyVending: 50 });
  const few = scoreLead({ category: "bakery", nearbyVending: 3 });
  assert.equal(many.score, few.score);
});

test("selling takeaway counts as the easy-expansion signal", () => {
  const plain = scoreLead({ category: "bakery", phone: "051" });
  const takeaway = scoreLead({
    category: "bakery",
    phone: "051",
    sellsTakeaway: true,
  });
  assert.ok(takeaway.score > plain.score);
  assert.match(takeaway.reason, /verkoopt afhaal/);
});

test("businesses that portion and wrap are flagged for the packaging line", () => {
  // MATO verkoopt ook verpakking; een traiteur is daarvoor een gesprek, ook als
  // een automaat nog niet aan de orde is.
  assert.match(scoreLead({ category: "traiteur" }).reason, /ook voor verpakking/);
  assert.doesNotMatch(scoreLead({ category: "bakery" }).reason, /verpakking/);
});

test("the score never runs past 99 however many signals stack up", () => {
  const everything = scoreLead({
    category: "bakery",
    phone: "051 20 00 00",
    reviewCount: 900,
    hasVending: true,
    nearbyVending: 9,
    sellsTakeaway: true,
  });
  assert.equal(everything.score, 99);
});

test("the signals add up to the score, so it can be explained", () => {
  // De reden dat dit een lijst is en geen optelsom in één regel: "waarom is dit
  // een 87?" hoort beantwoordbaar te zijn.
  const scored = scoreLead({
    category: "butcher",
    phone: "051",
    nearbyVending: 1,
    sellsTakeaway: true,
  });
  const sum = scored.signals.reduce((total, s) => total + s.points, 0);
  assert.equal(scored.score, Math.min(99, sum + 10));
});

test("a business with no phone still scores something", () => {
  // Het net staat wijd open: onbereikbaar is een lage score, geen uitsluiting.
  assert.ok(scoreLead({ category: "cafe", phone: null }).score > 0);
});
