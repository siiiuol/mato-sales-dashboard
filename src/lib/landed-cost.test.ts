import test from "node:test";
import assert from "node:assert/strict";
import { calculateLandedCost } from "./landed-cost";

test("basic landed cost without extras equals goods cost", () => {
  const r = calculateLandedCost({ quantity: 100, unitPrice: 2 });
  assert.equal(r.goodsCostEur, 200);
  assert.equal(r.totalOrderCostEur, 200);
  assert.equal(r.landedUnitCostEur, 2);
  assert.equal(r.grossProfitPerUnitEur, null);
});

test("currency conversion applies to every cost component", () => {
  const r = calculateLandedCost({
    quantity: 1000,
    unitPrice: 1.5, // USD
    fxToEur: 0.9,
    setupCost: 100,
    intlShipping: 400,
  });
  assert.equal(r.goodsCostEur, 1350);
  assert.equal(r.fixedCostsEur, 90);
  assert.equal(r.shippingEur, 360);
  assert.equal(r.totalOrderCostEur, 1350 + 90 + 360);
});

test("customs applies on goods plus freight, contingency on subtotal", () => {
  const r = calculateLandedCost({
    quantity: 100,
    unitPrice: 10,
    intlShipping: 200,
    customsPct: 10,
    contingencyPct: 5,
  });
  // goods 1000 + shipping 200 → customs 120 → subtotal 1320 → contingency 66
  assert.equal(r.customsEur, 120);
  assert.equal(r.contingencyEur, 66);
  assert.equal(r.totalOrderCostEur, 1386);
  assert.equal(r.landedUnitCostEur, 13.86);
});

test("margin outputs against a target selling price", () => {
  const r = calculateLandedCost({
    quantity: 100,
    unitPrice: 1,
    targetSellPrice: 2,
  });
  assert.equal(r.grossProfitPerUnitEur, 1);
  assert.equal(r.grossMarginPct, 50);
});

test("break-even recovers order-level fixed costs", () => {
  const r = calculateLandedCost({
    quantity: 1000,
    unitPrice: 1,
    mouldCost: 500,
    targetSellPrice: 2,
  });
  // €500 fixed / €1 profit per unit → 500 units
  assert.equal(r.breakEvenQty, 500);
});

test("break-even is null when selling below variable cost", () => {
  const r = calculateLandedCost({
    quantity: 100,
    unitPrice: 3,
    targetSellPrice: 2,
  });
  assert.equal(r.breakEvenQty, null);
  assert.ok((r.grossProfitPerUnitEur ?? 0) < 0);
});

test("zero quantity never divides by zero", () => {
  const r = calculateLandedCost({ quantity: 0, unitPrice: 5, targetSellPrice: 9 });
  assert.equal(r.landedUnitCostEur, 0);
  assert.equal(r.totalOrderCostEur, 0);
});
