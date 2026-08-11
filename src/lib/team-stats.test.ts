import test from "node:test";
import assert from "node:assert/strict";
import {
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
