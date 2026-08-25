import assert from "node:assert/strict";
import test from "node:test";
import {
  duplicateScore,
  normalizeBusinessName,
  normalizePhone,
  normalizeWebsite,
  potentialDuplicatePairs,
} from "./dedupe";

test("naam, telefoon en website worden brononafhankelijk genormaliseerd", () => {
  assert.equal(normalizeBusinessName("Bakkerij Dé Smaak BV"), "bakkerij de smaak");
  assert.equal(normalizePhone("+32 (0)51 12 34 56"), "051123456");
  assert.equal(normalizePhone("0032 51 12 34 56"), "051123456");
  assert.equal(normalizeWebsite("https://www.MATO.be/contact"), "mato.be");
});

test("dezelfde telefoon weegt zwaarder dan een licht afwijkende naam", () => {
  assert.equal(
    duplicateScore(
      { name: "Bakkerij De Smaak", phone: "051 12 34 56" },
      { name: "De Smaak Diksmuide", phone: "+32 51 12 34 56" }
    ),
    100
  );
});

test("dezelfde naam binnen honderd meter is een waarschijnlijke dubbel", () => {
  assert.equal(
    duplicateScore(
      { name: "Slagerij Jan", lat: 51, lng: 2.86 },
      { name: "Slagerij Jan BV", lat: 51.0003, lng: 2.8602 }
    ),
    85
  );
});

test("verre zaken met een generieke naam worden niet samengevoegd", () => {
  assert.equal(
    duplicateScore(
      { name: "Bakkerij", city: "Gent", lat: 51.05, lng: 3.72 },
      { name: "Bakkerij", city: "Brugge", lat: 51.2, lng: 3.22 }
    ),
    0
  );
});

test("potentiële dubbels worden maar één keer als paar gemeld", () => {
  const pairs = potentialDuplicatePairs([
    { id: "a", name: "MATO", website: "mato.be" },
    { id: "b", name: "Mato Automaat", website: "https://www.mato.be" },
    { id: "c", name: "Andere zaak" },
  ]);
  assert.deepEqual(
    pairs.map((pair) => [pair.first.id, pair.second.id]),
    [["a", "b"]]
  );
});
