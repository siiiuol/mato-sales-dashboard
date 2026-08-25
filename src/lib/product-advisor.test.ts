import test from "node:test";
import assert from "node:assert/strict";
import { adviseProduct, type ProductAdvisorInput } from "./product-advisor";

const base: ProductAdvisorInput = {
  productType: "FOOD",
  temperature: "CHILLED",
  fragile: false,
  assortment: "MEDIUM",
  location: "INDOOR",
};

test("product advice prioritises frozen requirements", () => {
  assert.equal(
    adviseProduct({ ...base, productType: "MIXED", temperature: "FROZEN" }).model,
    "F1"
  );
});

test("product advice uses locker compartments for flowers and gifts", () => {
  assert.equal(
    adviseProduct({ ...base, productType: "FLOWERS_GIFTS" }).model,
    "L1"
  );
});

test("product advice sizes lift models for fragile assortments", () => {
  assert.equal(
    adviseProduct({ ...base, fragile: true, assortment: "SMALL" }).model,
    "S1"
  );
  assert.equal(
    adviseProduct({ ...base, fragile: true, assortment: "MEDIUM" }).model,
    "M1"
  );
  assert.equal(
    adviseProduct({ ...base, fragile: true, assortment: "LARGE" }).model,
    "B1"
  );
});

test("product advice uses C1 for a focused drink assortment", () => {
  assert.equal(adviseProduct({ ...base, productType: "DRINK" }).model, "C1");
});

test("product advice uses T1 for a large mixed assortment", () => {
  assert.equal(
    adviseProduct({
      ...base,
      productType: "MIXED",
      assortment: "LARGE",
    }).model,
    "T1"
  );
});
