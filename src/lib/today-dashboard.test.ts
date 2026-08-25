import assert from "node:assert/strict";
import test from "node:test";
import {
  isLeadStale,
  leadFocusWhere,
  shopFreeSlots,
  utcDayBounds,
} from "./today-dashboard";

const now = new Date("2026-08-24T10:00:00.000Z");

test("vandaag gebruikt vaste UTC-daggrenzen", () => {
  assert.deepEqual(utcDayBounds(now), {
    start: new Date("2026-08-24T00:00:00.000Z"),
    end: new Date("2026-08-25T00:00:00.000Z"),
  });
});

test("een lead wordt pas na veertien dagen stil genoemd", () => {
  assert.equal(
    isLeadStale(
      {
        lastTouchedAt: new Date("2026-08-10T09:59:59.999Z"),
        createdAt: now,
      },
      now
    ),
    true
  );
  assert.equal(
    isLeadStale(
      { lastTouchedAt: null, createdAt: new Date("2026-08-20T00:00:00.000Z") },
      now
    ),
    false
  );
});

test("focusfilters maken afzonderlijke vandaag- en te-laatquery's", () => {
  assert.deepEqual(leadFocusWhere("today", now).nextActionAt, {
    gte: new Date("2026-08-24T00:00:00.000Z"),
    lt: new Date("2026-08-25T00:00:00.000Z"),
  });
  assert.deepEqual(leadFocusWhere("overdue", now).nextActionAt, {
    lt: new Date("2026-08-24T00:00:00.000Z"),
  });
});

test("vrije shopplaatsen tellen alleen unieke geldige plaatsnummers", () => {
  assert.equal(
    shopFreeSlots(8, [
      { shopSlot: 1 },
      { shopSlot: 1 },
      { shopSlot: 3 },
      { shopSlot: null },
      { shopSlot: 99 },
    ]),
    6
  );
});
