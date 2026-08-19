import test from "node:test";
import assert from "node:assert/strict";
import { addDays, stepsFor, CADENCES } from "./cadences";

const start = new Date("2026-08-18T09:00:00Z");

test("addDays moves forward in whole days, in UTC", () => {
  assert.equal(addDays(start, 5).toISOString(), "2026-08-23T09:00:00.000Z");
});

test("addDays with zero is the same instant", () => {
  assert.equal(addDays(start, 0).getTime(), start.getTime());
});

test("LEAD_FOLLOWUP has two steps, in order, five days apart at minimum", () => {
  const steps = stepsFor("LEAD_FOLLOWUP", start);
  assert.equal(steps.length, 2);
  assert.equal(steps[0].step, 1);
  assert.equal(steps[1].step, 2);
  assert.ok(steps[1].dueAt.getTime() > steps[0].dueAt.getTime());
});

test("LEAD_FOLLOWUP step 1 falls exactly five days after the start", () => {
  const [first] = stepsFor("LEAD_FOLLOWUP", start);
  assert.equal(first.dueAt.toISOString(), "2026-08-23T09:00:00.000Z");
});

test("CUSTOMER_ONBOARDING has three steps spanning a quarter", () => {
  const steps = stepsFor("CUSTOMER_ONBOARDING", start);
  assert.equal(steps.length, 3);
  // Dag 90 mag nooit vóór dag 30 vallen, en dag 30 nooit vóór dag 7 — anders
  // krijgt de klant de kwartaalcheck voor de kennismaking.
  assert.ok(steps[0].dueAt.getTime() < steps[1].dueAt.getTime());
  assert.ok(steps[1].dueAt.getTime() < steps[2].dueAt.getTime());
});

test("every cadence step has a non-empty Dutch title", () => {
  for (const key of Object.keys(CADENCES) as Array<keyof typeof CADENCES>) {
    for (const step of CADENCES[key]) {
      assert.ok(step.title.trim().length > 0, `${key} stap ${step.step} heeft geen titel`);
    }
  }
});

test("step numbers within one cadence are unique and start at 1", () => {
  for (const key of Object.keys(CADENCES) as Array<keyof typeof CADENCES>) {
    const numbers = CADENCES[key].map((s) => s.step);
    assert.equal(new Set(numbers).size, numbers.length, `${key} heeft dubbele stapnummers`);
    assert.equal(Math.min(...numbers), 1, `${key} begint niet bij stap 1`);
  }
});

test("stepsFor defaults to now when no start is given", () => {
  const before = Date.now();
  const [first] = stepsFor("LEAD_FOLLOWUP");
  const after = Date.now();
  const expectedEarliest = before + 5 * 24 * 60 * 60 * 1000;
  const expectedLatest = after + 5 * 24 * 60 * 60 * 1000;
  assert.ok(first.dueAt.getTime() >= expectedEarliest - 1000);
  assert.ok(first.dueAt.getTime() <= expectedLatest + 1000);
});
