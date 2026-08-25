import assert from "node:assert/strict";
import test from "node:test";
import { nextCadenceTask } from "./cadence-display";

test("de eerstvolgende open cadansstap wordt gekozen", () => {
  const next = nextCadenceTask([
    { id: "2", title: "Tweede", status: "OPEN", dueAt: null, cadenceStep: 2 },
    { id: "1", title: "Eerste", status: "OPEN", dueAt: null, cadenceStep: 1 },
  ]);
  assert.equal(next?.id, "1");
});

test("afgewerkte en geannuleerde stappen zijn niet meer actief", () => {
  assert.equal(
    nextCadenceTask([
      { id: "1", title: "Klaar", status: "DONE", dueAt: null, cadenceStep: 1 },
      {
        id: "2",
        title: "Geannuleerd",
        status: "CANCELLED",
        dueAt: null,
        cadenceStep: 2,
      },
    ]),
    null
  );
});
