import test from "node:test";
import assert from "node:assert/strict";
import { crossSellSignals } from "./cross-sell";

const now = new Date("2026-09-09T12:00:00Z");

function row(
  partial: Partial<Parameters<typeof crossSellSignals>[0][number]> & {
    id: string;
    customerId: string;
    customerName: string;
  }
) {
  return {
    site: "EXTERNAL",
    status: "ACTIVE",
    contractEndsAt: null,
    hasActiveMachine: true,
    lastPurchaseAt: new Date("2026-08-01T12:00:00Z"),
    ...partial,
  };
}

test("a contract ending within 90 days becomes a renewal signal", () => {
  const signals = crossSellSignals(
    [
      row({
        id: "p1",
        customerId: "c1",
        customerName: "Bakkerij Zoet",
        contractEndsAt: new Date("2026-10-01T12:00:00Z"),
        hasActiveMachine: true,
      }),
    ],
    { now }
  );
  assert.equal(signals.length, 1);
  assert.equal(signals[0].kind, "renewal");
  assert.match(signals[0].reason, /eindigt over/);
});

test("a far-away contract end is ignored", () => {
  const signals = crossSellSignals(
    [
      row({
        id: "p1",
        customerId: "c1",
        customerName: "Zoet",
        contractEndsAt: new Date("2027-09-09T12:00:00Z"),
        lastPurchaseAt: new Date("2026-09-01T12:00:00Z"),
      }),
    ],
    { now }
  );
  assert.equal(signals.length, 0);
});

test("an active machine without any purchase is flagged", () => {
  const signals = crossSellSignals(
    [
      row({
        id: "p1",
        customerId: "c1",
        customerName: "Stil",
        lastPurchaseAt: null,
        hasActiveMachine: true,
      }),
    ],
    { now }
  );
  assert.equal(signals[0].kind, "silent_machine");
  assert.match(signals[0].reason, /zonder afname/);
});

test("a recent purchase suppresses the quiet-machine signal", () => {
  const signals = crossSellSignals(
    [
      row({
        id: "p1",
        customerId: "c1",
        customerName: "Actief",
        lastPurchaseAt: new Date("2026-09-01T12:00:00Z"),
        hasActiveMachine: true,
      }),
    ],
    { now, purchaseQuietDays: 90 }
  );
  assert.equal(signals.length, 0);
});

test("removed placements are ignored", () => {
  const signals = crossSellSignals(
    [
      row({
        id: "p1",
        customerId: "c1",
        customerName: "Weg",
        status: "REMOVED",
        contractEndsAt: new Date("2026-09-20T12:00:00Z"),
        lastPurchaseAt: null,
      }),
    ],
    { now }
  );
  assert.equal(signals.length, 0);
});

test("renewals outrank quiet-machine signals", () => {
  const signals = crossSellSignals(
    [
      row({
        id: "p-quiet",
        customerId: "c-quiet",
        customerName: "Stil",
        lastPurchaseAt: null,
      }),
      row({
        id: "p-renew",
        customerId: "c-renew",
        customerName: "Bijna",
        contractEndsAt: new Date("2026-09-20T12:00:00Z"),
        lastPurchaseAt: new Date("2026-09-01T12:00:00Z"),
      }),
    ],
    { now }
  );
  assert.equal(signals[0].kind, "renewal");
  assert.equal(signals[0].customerName, "Bijna");
});

test("one quiet signal per customer even with two machines", () => {
  const signals = crossSellSignals(
    [
      row({
        id: "p1",
        customerId: "c1",
        customerName: "Dubbel",
        lastPurchaseAt: null,
      }),
      row({
        id: "p2",
        customerId: "c1",
        customerName: "Dubbel",
        lastPurchaseAt: null,
      }),
    ],
    { now }
  );
  assert.equal(signals.filter((s) => s.kind === "silent_machine").length, 1);
});
