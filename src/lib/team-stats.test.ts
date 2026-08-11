import test from "node:test";
import assert from "node:assert/strict";
import {
  bucketByDay,
  commissionForDeal,
  commissionForDeals,
  conversionRate,
  rankByRevenue,
  roi,
} from "./team-stats";

const PERCENT = { commissionType: "PERCENT", commissionValue: 5 };
const FIXED = { commissionType: "FIXED", commissionValue: 150 };

test("percentage commission is a share of the deal", () => {
  assert.equal(commissionForDeal(PERCENT, 4000), 200);
});

test("fixed commission ignores the deal value", () => {
  // Dat is de hele afspraak bij een vast bedrag — ook een kleine verkoop telt
  // volledig mee.
  assert.equal(commissionForDeal(FIXED, 4000), 150);
  assert.equal(commissionForDeal(FIXED, 100), 150);
});

test("commission adds up over several deals", () => {
  assert.equal(commissionForDeals(PERCENT, [4000, 6000]), 500);
  assert.equal(commissionForDeals(FIXED, [4000, 6000]), 300);
});

test("no deals means no commission", () => {
  assert.equal(commissionForDeals(PERCENT, []), 0);
  assert.equal(commissionForDeals(FIXED, []), 0);
});

test("ROI counts commission as part of the cost", () => {
  const result = roi({ revenue: 10000, cost: 2000, commission: 500 });
  assert.equal(result.totalCost, 2500);
  assert.equal(result.profit, 7500);
  assert.equal(result.ratio, 4);
});

test("ROI reports a loss as a negative profit rather than hiding it", () => {
  const result = roi({ revenue: 1000, cost: 2000, commission: 0 });
  assert.equal(result.profit, -1000);
});

test("a costless employee has no ratio instead of infinity", () => {
  // Oneindig op een dashboard zetten is een leugen; leeg is eerlijk.
  const result = roi({ revenue: 5000, cost: 0, commission: 0 });
  assert.equal(result.ratio, null);
  assert.equal(result.profit, 5000);
});

test("nobody called yet is not the same as a zero percent rate", () => {
  assert.equal(conversionRate(0, 0), null);
  assert.equal(conversionRate(0, 10), 0);
});

test("conversion is wins over calls", () => {
  assert.equal(conversionRate(3, 12), 0.25);
});

test("day buckets run forwards and end today", () => {
  const now = new Date(2026, 7, 11, 15, 0, 0);
  const buckets = bucketByDay([], 7, now);
  assert.equal(buckets.length, 7);
  assert.equal(buckets[6].key, "2026-08-11", "last bucket must be today");
  assert.equal(buckets[0].key, "2026-08-05", "first bucket is six days back");
});

test("quiet days stay in the series as zero", () => {
  // Ze weglaten zou een week stilte er hetzelfde uit laten zien als een week
  // doorwerken.
  const now = new Date(2026, 7, 11, 15, 0, 0);
  const buckets = bucketByDay([new Date(2026, 7, 11, 9, 0, 0)], 3, now);
  assert.deepEqual(
    buckets.map((b) => b.count),
    [0, 0, 1]
  );
});

test("day buckets cross a month boundary", () => {
  const now = new Date(2026, 7, 2, 12, 0, 0);
  const buckets = bucketByDay([], 4, now);
  assert.deepEqual(
    buckets.map((b) => b.key),
    ["2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"]
  );
});

test("a late evening call counts on its own local day", () => {
  // Via toISOString zou 23:30 lokaal in de zomertijd op morgen belanden.
  const now = new Date(2026, 7, 11, 23, 59, 0);
  const buckets = bucketByDay([new Date(2026, 7, 11, 23, 30, 0)], 2, now);
  assert.deepEqual(
    buckets.map((b) => b.count),
    [0, 1]
  );
});

test("ranking puts the biggest earner first and does not mutate", () => {
  const rows = [{ revenue: 100 }, { revenue: 900 }, { revenue: 400 }];
  const ranked = rankByRevenue(rows);
  assert.deepEqual(
    ranked.map((r) => r.revenue),
    [900, 400, 100]
  );
  assert.deepEqual(
    rows.map((r) => r.revenue),
    [100, 900, 400],
    "the caller's array must be left alone"
  );
});
