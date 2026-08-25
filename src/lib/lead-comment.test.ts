import assert from "node:assert/strict";
import test from "node:test";

/** Spiegel van de trim/lengte-regel in postLeadComment. */
function normalizeCommentBody(raw: string): string | null {
  const body = raw.trim();
  if (!body || body.length > 4000) return null;
  return body;
}

test("lege of te lange teamchatberichten worden geweigerd", () => {
  assert.equal(normalizeCommentBody("   "), null);
  assert.equal(normalizeCommentBody(""), null);
  assert.equal(normalizeCommentBody("x".repeat(4001)), null);
  assert.equal(normalizeCommentBody("  Hallo collega  "), "Hallo collega");
});
