import test from "node:test";
import assert from "node:assert/strict";
import { euroCents, rankSupplierQuotes } from "./sourcing-economics";

const base = {
  unitPrice: 1,
  fxToEur: 0.9,
  qty: 1000,
};

test("cheapest landed cost ranks first", () => {
  const ranked = rankSupplierQuotes(
    [
      {
        id: "expensive",
        supplierName: "Duur",
        unitPrice: 2,
        fxToEur: 1,
        intlShipping: 500,
      },
      {
        id: "cheap",
        supplierName: "Goedkoop",
        unitPrice: 1,
        fxToEur: 1,
        intlShipping: 50,
      },
    ],
    { quantity: 1000 }
  );
  assert.equal(ranked[0].id, "cheap");
  assert.ok(ranked[0].unitLandedEur < ranked[1].unitLandedEur);
});

test("MOQ that exceeds quantity sinks below valid quotes", () => {
  const ranked = rankSupplierQuotes(
    [
      {
        id: "high-moq",
        supplierName: "Fabriek",
        ...base,
        moq: 50_000,
        unitPrice: 0.1,
      },
      {
        id: "ok",
        supplierName: "Klein",
        ...base,
        moq: 500,
        unitPrice: 0.5,
      },
    ],
    { quantity: 1000, maxMoq: 5000 }
  );
  assert.equal(ranked[0].id, "ok");
  assert.equal(ranked[0].passesMoq, true);
  assert.equal(ranked[1].passesMoq, false);
});

test("required margin yields a suggested sell price", () => {
  const [quote] = rankSupplierQuotes(
    [{ id: "a", supplierName: "A", unitPrice: 1, fxToEur: 1 }],
    { quantity: 100, requiredMarginPct: 40 }
  );
  assert.ok(quote.suggestedSellEur != null);
  assert.ok(quote.suggestedSellEur! > quote.unitLandedEur);
});

test("margin at target sell price is computed", () => {
  const [quote] = rankSupplierQuotes(
    [{ id: "a", supplierName: "A", unitPrice: 0.6, fxToEur: 1 }],
    { quantity: 100, targetSellPrice: 1 }
  );
  assert.ok(quote.marginAtTarget != null);
  assert.ok(quote.marginAtTarget! > 0);
  assert.ok(quote.marginAtTarget! < 1);
});

test("euroCents formats Belgian euros", () => {
  assert.match(euroCents(1.5), /1[,.]50/);
});
