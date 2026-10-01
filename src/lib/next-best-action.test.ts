import test from "node:test";
import assert from "node:assert/strict";
import {
  NBA_WEIGHTS,
  dealExpectedEuro,
  rankLeads,
  scoreLead,
} from "./next-best-action";

const noon = new Date("2026-09-09T12:00:00Z");

test("an overdue lead outranks an identical lead that is only due today", () => {
  const overdue = scoreLead(
    {
      id: "a",
      nextActionAt: new Date("2026-09-07T10:00:00Z"),
      expectedValue: 1000,
    },
    noon
  );
  const today = scoreLead(
    {
      id: "b",
      nextActionAt: new Date("2026-09-09T10:00:00Z"),
      expectedValue: 1000,
    },
    noon
  );
  assert.ok(overdue.score > today.score);
  assert.match(overdue.reason, /Te laat/);
});

test("a larger deal outranks a smaller one in the same stage", () => {
  const big = scoreLead(
    {
      id: "big",
      nextActionAt: null,
      expectedValue: 40_000,
      dealStage: "PROPOSAL",
    },
    noon
  );
  const small = scoreLead(
    {
      id: "small",
      nextActionAt: null,
      expectedValue: 2_000,
      dealStage: "PROPOSAL",
    },
    noon
  );
  assert.ok(big.score > small.score);
  assert.match(big.reason, /40\.000|40000/);
});

test("unanswered inbound mail beats a quiet lead of equal value", () => {
  const withMail = scoreLead(
    {
      id: "mail",
      nextActionAt: null,
      expectedValue: 5_000,
      hasUnansweredInbound: true,
    },
    noon
  );
  const quiet = scoreLead(
    {
      id: "quiet",
      nextActionAt: null,
      expectedValue: 5_000,
      hasUnansweredInbound: false,
    },
    noon
  );
  assert.ok(withMail.score > quiet.score);
  assert.equal(
    withMail.score - quiet.score,
    NBA_WEIGHTS.unansweredInboundBoost
  );
  assert.match(withMail.reason, /Mail binnen/);
});

test("silence slowly lowers the score but is capped", () => {
  const fresh = scoreLead(
    {
      id: "fresh",
      nextActionAt: null,
      lastTouchedAt: noon,
      expectedValue: 10_000,
    },
    noon
  );
  const stale = scoreLead(
    {
      id: "stale",
      nextActionAt: null,
      lastTouchedAt: new Date("2026-01-01T12:00:00Z"),
      expectedValue: 10_000,
    },
    noon
  );
  assert.ok(fresh.score > stale.score);
  const maxPenalty =
    NBA_WEIGHTS.maxSilenceDays * NBA_WEIGHTS.silencePenaltyPerDay;
  assert.ok(fresh.score - stale.score <= maxPenalty + 0.01);
});

test("rankLeads puts the highest score first and is stable on ties", () => {
  const ranked = rankLeads(
    [
      { id: "c", nextActionAt: null, expectedValue: 100 },
      { id: "a", nextActionAt: null, expectedValue: 100 },
      { id: "b", nextActionAt: null, expectedValue: 5_000 },
    ],
    noon
  );
  assert.equal(ranked[0].id, "b");
  assert.equal(ranked[1].id, "a");
  assert.equal(ranked[2].id, "c");
});

test("dealExpectedEuro applies probability and prefers wonValue", () => {
  assert.equal(
    dealExpectedEuro({ expectedValue: 10_000, probability: 50 }),
    5_000
  );
  assert.equal(
    dealExpectedEuro({ expectedValue: 10_000, probability: null }),
    10_000
  );
  assert.equal(
    dealExpectedEuro({ expectedValue: 10_000, probability: 50, wonValue: 8_000 }),
    8_000
  );
  assert.equal(dealExpectedEuro({ expectedValue: 0 }), 0);
});

test("WON and LOST stages contribute zero stage weight", () => {
  const open = scoreLead(
    {
      id: "open",
      nextActionAt: null,
      expectedValue: 10_000,
      dealStage: "QUALIFIED",
    },
    noon
  );
  const won = scoreLead(
    {
      id: "won",
      nextActionAt: null,
      expectedValue: 10_000,
      dealStage: "WON",
    },
    noon
  );
  assert.ok(open.score > won.score);
});
