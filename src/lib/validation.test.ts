import test from "node:test";
import assert from "node:assert/strict";
import { leadStatusSchema } from "./validation";




test("SKIPPED is a valid lead status so triage can hide leads reversibly", () => {
  assert.equal(leadStatusSchema.safeParse("SKIPPED").success, true);
});

test("an unknown status is still rejected", () => {
  assert.equal(leadStatusSchema.safeParse("MAYBE_LATER").success, false);
});
