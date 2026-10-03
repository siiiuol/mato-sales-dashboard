import { test } from "node:test";
import assert from "node:assert/strict";
import {
  busiestHour,
  footfallByCamera,
  footfallByHour,
  parseUnifiEvent,
} from "./camera-events";

// Wat UniFi werkelijk stuurt bij een Alarm Manager-webhook met een kale URL:
// een GET zonder body en zonder parameters. De cameranaam moet dus uit de
// query-string komen, één regel per camera.
test("leest de cameranaam uit de query-string van een GET", () => {
  const parsed = parseUnifiEvent({ camera: "Automaat 3 & 4", type: "person" });
  assert.equal(parsed.cameraName, "Automaat 3 & 4");
});

test("leest de cameranaam uit een geneste payload", () => {
  const parsed = parseUnifiEvent({
    trigger: { device: { name: "Automaat 5&6", id: "abc" }, eventType: "person" },
  });
  assert.equal(parsed.cameraName, "Automaat 5&6");
  assert.equal(parsed.cameraId, "abc");
});

test("zonder naam blijft het leeg in plaats van te raden", () => {
  const parsed = parseUnifiEvent({ method: "GET", query: {} });
  assert.equal(parsed.cameraName, null);
  assert.equal(parsed.eventType, "person");
});

test("een tijdstip in epoch-milliseconden wordt een datum", () => {
  const parsed = parseUnifiEvent({ trigger: { timestamp: 1_767_225_600_000 } });
  assert.ok(parsed.occurredAt instanceof Date);
  assert.equal(parsed.occurredAt?.getTime(), 1_767_225_600_000);
});

test("onzin als payload laat niets ontploffen", () => {
  for (const onzin of [null, undefined, "tekst", 42, []]) {
    const parsed = parseUnifiEvent(onzin);
    assert.equal(parsed.cameraName, null);
    assert.equal(parsed.occurredAt, null);
  }
});

test("telt per camera, aflopend", () => {
  const rijen = footfallByCamera([
    { cameraName: "Gang" },
    { cameraName: "Automaat 1 & 2" },
    { cameraName: "Automaat 1 & 2" },
    { cameraName: null },
  ]);
  assert.deepEqual(rijen, [
    { label: "Automaat 1 & 2", count: 2 },
    { label: "Gang", count: 1 },
    { label: "Onbekende camera", count: 1 },
  ]);
});

test("verdeelt over 24 uren en valt terug op ontvangsttijd", () => {
  const middag = new Date("2026-10-03T12:30:00+02:00"); // 12 u in Brussel
  const buckets = footfallByHour([
    { occurredAt: middag, receivedAt: new Date("2026-10-03T23:00:00+02:00") },
    { occurredAt: null, receivedAt: middag },
  ]);
  assert.equal(buckets.length, 24);
  assert.equal(buckets[12].count, 2);
  assert.equal(buckets.reduce((s, b) => s + b.count, 0), 2);
});

// Zonder ondergrens zou één toevallige detectie "drukste uur" heten. Dat is
// precies het soort getal dat eerlijk moet blijven.
test("noemt pas een drukste uur bij genoeg waarnemingen", () => {
  const weinig = footfallByHour(
    Array.from({ length: 5 }, () => ({
      occurredAt: new Date("2026-10-03T12:30:00+02:00"),
      receivedAt: new Date("2026-10-03T12:30:00+02:00"),
    }))
  );
  assert.equal(busiestHour(weinig), null);

  const genoeg = footfallByHour(
    Array.from({ length: 25 }, () => ({
      occurredAt: new Date("2026-10-03T12:30:00+02:00"),
      receivedAt: new Date("2026-10-03T12:30:00+02:00"),
    }))
  );
  assert.equal(busiestHour(genoeg)?.hour, 12);
});
