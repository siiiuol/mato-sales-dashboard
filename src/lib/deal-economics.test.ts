import test from "node:test";
import assert from "node:assert/strict";
import {
  dealEconomics,
  landedCost,
  sellPriceForMargin,
} from "./deal-economics";

test("deal without cost data reports null margin instead of 100%", () => {
  const result = dealEconomics({
    lines: [{ qty: 2, unitPrice: 5_000 }],
  });
  assert.equal(result.revenue, 10_000);
  assert.equal(result.cost, 0);
  assert.equal(result.hasCostData, false);
  assert.equal(result.margin, null);
});

test("gross profit subtracts line cost, setup, monthly and commission", () => {
  const result = dealEconomics({
    lines: [{ qty: 1, unitPrice: 10_000, unitCost: 4_000 }],
    setupCost: 500,
    monthlyCost: 20,
    monthlyHorizon: 12,
    commissionCost: 300,
  });
  assert.equal(result.breakdown.lineCost, 4_000);
  assert.equal(result.breakdown.setupCost, 500);
  assert.equal(result.breakdown.monthlyCostTotal, 240);
  assert.equal(result.breakdown.commissionCost, 300);
  assert.equal(result.cost, 4_000 + 500 + 240 + 300);
  assert.equal(result.grossProfit, 10_000 - result.cost);
  assert.equal(result.hasCostData, true);
  assert.ok(result.margin != null);
  assert.ok(result.margin! > 0 && result.margin! < 1);
});

test("discountPercent reduces line revenue before margin", () => {
  const result = dealEconomics({
    lines: [{ qty: 1, unitPrice: 1_000, unitCost: 400 }],
    discountPercent: 10,
  });
  assert.equal(result.breakdown.discount, 100);
  assert.equal(result.revenue, 900);
  assert.equal(result.grossProfit, 500);
});

test("recurring value over a horizon adds to revenue", () => {
  const result = dealEconomics({
    lines: [{ qty: 1, unitPrice: 0, unitCost: 0 }],
    recurringValue: 200,
    monthlyHorizon: 12,
    setupCost: 100,
  });
  assert.equal(result.revenue, 2_400);
  assert.equal(result.hasCostData, true);
  assert.equal(result.grossProfit, 2_300);
});

test("negative or NaN inputs are treated as zero", () => {
  const result = dealEconomics({
    lines: [{ qty: -2, unitPrice: Number.NaN, unitCost: -50 }],
    discountPercent: -10,
    setupCost: Number.NaN,
  });
  assert.equal(result.revenue, 0);
  assert.equal(result.cost, 0);
  assert.equal(result.hasCostData, false);
});

test("landedCost converts currency and spreads one-off fees", () => {
  const result = landedCost({
    unitPrice: 10,
    fxToEur: 0.9,
    intlShipping: 100,
    customsPct: 10,
    contingencyPct: 0,
    qty: 100,
  });
  // goods = 10 * 0.9 * 100 = 900
  // withCustoms = 900 * 1.1 = 990
  // oneOff = 100 * 0.9 = 90
  // total = 1080 → unit = 10.8
  assert.equal(result.batchLandedEur, 1_080);
  assert.equal(result.unitLandedEur, 10.8);
});

test("sellPriceForMargin returns null at 100% and rounds up correctly", () => {
  assert.equal(sellPriceForMargin(60, 40), 100);
  assert.equal(sellPriceForMargin(60, 100), null);
  assert.equal(sellPriceForMargin(0, 40), 0);
});
