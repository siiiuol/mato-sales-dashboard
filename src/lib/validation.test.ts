import test from "node:test";
import assert from "node:assert/strict";
import {
  intelligenceImportSchema,
  reviewActionSchema,
} from "./validation";

test("intelligence import requires stable establishment id", () => {
  const result = intelligenceImportSchema.safeParse({ name: "Example" });
  assert.equal(result.success, false);
});

test("intelligence import normalizes numeric identifiers", () => {
  const result = intelligenceImportSchema.parse({
    intelligence_establishment_id: 42,
    enterprise_number: 123,
    name: "Example",
  });
  assert.equal(result.intelligence_establishment_id, "42");
  assert.equal(result.enterprise_number, "123");
});

test("review actions reject arbitrary commands", () => {
  assert.equal(reviewActionSchema.safeParse("auto_send_email").success, false);
});
