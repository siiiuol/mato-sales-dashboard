import test from "node:test";
import assert from "node:assert/strict";
import {
  averageCycleDays,
  conversionDisplay,
  countBy,
} from "./reporting";

test("reporting suppresses conversion rates for small samples", () => {
  assert.equal(conversionDisplay(1, 9), "te weinig data");
  assert.equal(conversionDisplay(2, 10), "20%");
  assert.equal(conversionDisplay(2, 717), "<1%");
});

test("reporting calculates average won cycle in days", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  assert.equal(
    averageCycleDays([
      { createdAt: start, wonAt: new Date("2026-01-03T00:00:00Z") },
      { createdAt: start, wonAt: new Date("2026-01-07T00:00:00Z") },
      { createdAt: start, wonAt: null },
    ]),
    4
  );
});

test("reporting groups unknown values and sorts largest first", () => {
  assert.deepEqual(
    countBy(
      [{ source: "OSM" }, { source: null }, { source: "OSM" }],
      (x) => x.source
    ),
    [
      { label: "OSM", count: 2 },
      { label: "Onbekend", count: 1 },
    ]
  );
});
