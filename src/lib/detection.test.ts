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
  assert.match(with_.reason, /already has vending/);
});

test("a reachable business outranks an identical one with no phone", () => {
  const reachable = scoreLead({ category: "bakery", phone: "+32 51 20 00 00" });
  const unreachable = scoreLead({ category: "bakery", phone: null });
  assert.ok(reachable.score > unreachable.score);
  assert.match(unreachable.reason, /no phone/);
});
