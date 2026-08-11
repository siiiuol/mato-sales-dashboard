import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateLoginRate,
  windowStart,
  MAX_PER_EMAIL,
  MAX_PER_IP,
  WINDOW_MINUTES,
} from "./rate-limit-policy";

test("a first attempt is allowed", () => {
  assert.equal(evaluateLoginRate(0, 0).allowed, true);
});

test("attempts are allowed right up to the limit, then blocked", () => {
  // De grens ligt óp het maximum: bij vijf mislukkingen is de zesde poging weg.
  assert.equal(evaluateLoginRate(MAX_PER_EMAIL - 1, 0).allowed, true);
  assert.equal(evaluateLoginRate(MAX_PER_EMAIL, 0).allowed, false);
});

test("one address cannot be locked out by a busy shared IP alone", () => {
  // Een kantoor deelt één IP. Onder de IP-grens blijft een schoon adres binnen.
  assert.equal(evaluateLoginRate(0, MAX_PER_IP - 1).allowed, true);
});

test("a single source hammering many addresses is blocked by IP", () => {
  assert.equal(evaluateLoginRate(0, MAX_PER_IP).allowed, false);
});

test("a blocked result says how long to wait", () => {
  const result = evaluateLoginRate(MAX_PER_EMAIL, 0);
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.ok(result.retryAfterMinutes > 0);
});

test("the counting window looks backwards, not forwards", () => {
  const now = new Date("2026-08-11T12:00:00.000Z");
  const start = windowStart(now);
  assert.ok(start < now, "window must start before now");
  assert.equal((now.getTime() - start.getTime()) / 60_000, WINDOW_MINUTES);
});
