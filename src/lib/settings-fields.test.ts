import test from "node:test";
import assert from "node:assert/strict";
import { definedOnly, nextPlainValue, nextSecretValue } from "./settings-fields";

test("a blank secret field leaves the stored value alone", () => {
  // Dit is de hele reden dat deze functie bestaat: een wachtwoordveld komt
  // altijd leeg terug, en dat als "wissen" lezen sloopt de koppeling zodra
  // iemand een ander veld op dezelfde pagina aanpast.
  assert.equal(nextSecretValue({ submitted: "" }), undefined);
  assert.equal(nextSecretValue({ submitted: "   " }), undefined);
});

test("a field that is not on the form is never written", () => {
  // Zo kan een tweede, kleiner formulier op dezelfde instellingen bestaan
  // zonder alles wat het niet toont leeg te maken.
  assert.equal(nextSecretValue({ submitted: null }), undefined);
  assert.equal(nextPlainValue(null), undefined);
});

test("an explicit clear does erase the value", () => {
  assert.equal(nextSecretValue({ submitted: "", clear: true }), "");
  assert.equal(nextSecretValue({ submitted: "sk-nog-iets", clear: true }), "");
});

test("a new secret is stored without surrounding whitespace", () => {
  // Geplakte sleutels slepen vaak een spatie of regeleinde mee; die geven
  // later een 401 die niemand aan het plakken koppelt.
  assert.equal(nextSecretValue({ submitted: "  sk-ant-abc  " }), "sk-ant-abc");
  assert.equal(nextSecretValue({ submitted: "sk-ant-abc\n" }), "sk-ant-abc");
});

test("a plain field can be emptied by submitting it empty", () => {
  // Een zichtbaar veld toont wél wat er staat, dus leeg is daar een keuze.
  assert.equal(nextPlainValue(""), "");
  assert.equal(nextPlainValue("  MATO  "), "MATO");
});

test("undefined fields drop out of the update", () => {
  assert.deepEqual(
    definedOnly({ a: "x", b: undefined, c: "", d: 0 }),
    { a: "x", c: "", d: 0 }
  );
});

test("an update with nothing to change is an empty object", () => {
  // Prisma accepteert dat en laat de rij ongemoeid.
  assert.deepEqual(definedOnly({ a: undefined, b: undefined }), {});
});
