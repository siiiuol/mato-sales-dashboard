import test from "node:test";
import assert from "node:assert/strict";
import {
  CLAIM_TTL_MINUTES,
  claimFilter,
  claimableWhere,
  staleClaimCutoff,
} from "./claims";

const NOW = new Date("2026-08-11T12:00:00.000Z");
const ME = "user-me";

test("the stale cutoff sits one TTL in the past", () => {
  const cutoff = staleClaimCutoff(NOW);
  assert.equal((NOW.getTime() - cutoff.getTime()) / 60_000, CLAIM_TTL_MINUTES);
});

test("an unclaimed lead is available", () => {
  const filter = claimFilter(ME, NOW);
  assert.ok(filter.OR.some((c) => "claimedById" in c && c.claimedById === null));
});

test("my own claim does not hide the lead from me", () => {
  // Zonder deze tak zou je je eigen kaart kwijtraken zodra je hem claimt.
  const filter = claimFilter(ME, NOW);
  assert.ok(filter.OR.some((c) => "claimedById" in c && c.claimedById === ME));
});

test("an expired claim frees the lead again", () => {
  const filter = claimFilter(ME, NOW);
  const expired = filter.OR.find((c) => "claimedAt" in c);
  assert.ok(expired, "there must be a branch on claim age");
  assert.deepEqual(
    (expired as { claimedAt: { lt: Date } }).claimedAt.lt,
    staleClaimCutoff(NOW)
  );
});

test("a fresh claim by someone else matches no branch", () => {
  // De drie takken zijn: niet geclaimd, door mij geclaimd, vervallen. Een verse
  // claim van een collega valt buiten alle drie — precies de bedoeling.
  const filter = claimFilter(ME, NOW);
  const other = { claimedById: "user-other", claimedAt: NOW };

  const matches = filter.OR.some((branch) => {
    if ("claimedById" in branch) return branch.claimedById === other.claimedById;
    if ("claimedAt" in branch) return other.claimedAt < branch.claimedAt.lt;
    return false;
  });
  assert.equal(matches, false);
});

test("the claim guard is scoped to one lead", () => {
  const where = claimableWhere("lead-1", ME, NOW);
  assert.equal(where.id, "lead-1");
  assert.ok(Array.isArray(where.OR));
});
