import test from "node:test";
import assert from "node:assert/strict";
import { groupTasksByDueDate } from "./tasks";

// Vast tijdstip, ver van middernacht in UTC — zodat de tests niet toevallig
// slagen of falen naargelang de tijdzone van de machine die ze uitvoert. De
// grens zelf ligt op UTC-middernacht (zie tasks.ts); dat testen de gerichte
// gevallen hieronder met expliciete UTC-tijdstippen, niet met "vandaag".
const now = new Date("2026-08-18T14:00:00Z");
const hour = 60 * 60 * 1000;

const task = (id: string, dueAt: Date | null) => ({ id, dueAt });

test("a task due a few hours from now is due today", () => {
  const groups = groupTasksByDueDate([task("a", new Date(now.getTime() + 2 * hour))], now);
  assert.deepEqual(groups.today.map((t) => t.id), ["a"]);
});

test("a task due a few hours ago is due today, not overdue", () => {
  const groups = groupTasksByDueDate([task("a", new Date(now.getTime() - 2 * hour))], now);
  assert.deepEqual(groups.today.map((t) => t.id), ["a"]);
  assert.equal(groups.overdue.length, 0);
});

test("a task due yesterday is overdue", () => {
  const groups = groupTasksByDueDate([task("a", new Date(now.getTime() - 26 * hour))], now);
  assert.deepEqual(groups.overdue.map((t) => t.id), ["a"]);
});

test("a task due in three days is later, not today", () => {
  const groups = groupTasksByDueDate([task("a", new Date(now.getTime() + 3 * 24 * hour))], now);
  assert.deepEqual(groups.later.map((t) => t.id), ["a"]);
});

test("a task with no due date is later, not lost", () => {
  const groups = groupTasksByDueDate([task("a", null)], now);
  assert.deepEqual(groups.later.map((t) => t.id), ["a"]);
});

test("every task lands in exactly one group", () => {
  const tasks = [
    task("overdue", new Date(now.getTime() - 3 * 24 * hour)),
    task("today", new Date(now.getTime() - hour)),
    task("later", new Date(now.getTime() + 3 * 24 * hour)),
    task("no-date", null),
  ];
  const groups = groupTasksByDueDate(tasks, now);
  const total = groups.overdue.length + groups.today.length + groups.later.length;
  assert.equal(total, tasks.length);
});

test("the boundary sits at UTC midnight, deterministically", () => {
  // Expliciete UTC-tijdstippen rond de grens zelf — dit is het enige geval
  // waar het precieze uur er wél toe doet, dus hier wel vaste tijdstippen.
  const referentie = new Date("2026-08-18T10:00:00Z");
  const groups = groupTasksByDueDate(
    [
      task("net-voor-middernacht", new Date("2026-08-17T23:59:00Z")),
      task("precies-middernacht", new Date("2026-08-18T00:00:00Z")),
    ],
    referentie
  );
  assert.deepEqual(groups.overdue.map((t) => t.id), ["net-voor-middernacht"]);
  assert.deepEqual(groups.today.map((t) => t.id), ["precies-middernacht"]);
});
