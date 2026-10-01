import test from "node:test";
import assert from "node:assert/strict";
import {
  FACT_KEYS,
  factLabel,
  isFactKey,
  normaliseFactValue,
  sanitizeSuggestedFacts,
} from "./customer-memory";

test("every fact key has a Dutch label", () => {
  for (const key of FACT_KEYS) {
    assert.ok(factLabel(key).trim().length > 0);
    assert.notEqual(factLabel(key), key);
  }
});

test("isFactKey rejects unknown keys", () => {
  assert.equal(isFactKey("beslisser"), true);
  assert.equal(isFactKey("favoriteColor"), false);
  assert.equal(isFactKey(""), false);
});

test("normaliseFactValue trims and caps length", () => {
  assert.equal(normaliseFactValue("  Jan   Peeters  "), "Jan Peeters");
  assert.equal(normaliseFactValue("x".repeat(600)).length, 500);
});

test("sanitizeSuggestedFacts keeps only known keys with values", () => {
  const facts = sanitizeSuggestedFacts([
    { key: "beslisser", value: "Marie", confidence: 0.9 },
    { key: "unknown", value: "x", confidence: 1 },
    { key: "bezwaar", value: "  ", confidence: 1 },
    { key: "budget", value: "rond 8k", confidence: 1.5 },
    { key: "beslisser", value: "Marie", confidence: 0.4 },
  ]);
  assert.equal(facts.length, 2);
  assert.equal(facts[0].key, "beslisser");
  assert.equal(facts[0].confidence, 0.9);
  assert.equal(facts[1].key, "budget");
  assert.equal(facts[1].confidence, 1);
});

test("sanitizeSuggestedFacts tolerates garbage input", () => {
  assert.deepEqual(sanitizeSuggestedFacts(null), []);
  assert.deepEqual(sanitizeSuggestedFacts("nope"), []);
  assert.deepEqual(sanitizeSuggestedFacts([{ key: 1 }]), []);
});
