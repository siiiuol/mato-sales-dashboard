import test from "node:test";
import assert from "node:assert/strict";
import {
  documentAmount,
  fillTemplate,
  formatDocumentNumber,
  missingPlaceholders,
  priceBreakdown,
  sequenceId,
  templateKeys,
} from "./documents";

test("placeholders are replaced by their value", () => {
  assert.equal(
    fillTemplate("Beste {{klant_naam}},", { klant_naam: "Bakkerij Loquet" }),
    "Beste Bakkerij Loquet,"
  );
});

test("spacing inside the braces does not matter", () => {
  assert.equal(fillTemplate("{{ naam }}", { naam: "MATO" }), "MATO");
});

test("numbers are written out, and zero is a real value", () => {
  // Zonder deze test glipt `0` er als ontbrekend doorheen, want het is falsy.
  assert.equal(fillTemplate("{{korting}}%", { korting: 0 }), "0%");
});

test("a missing value is left visible, not silently blanked", () => {
  // Een leeg veld in een contract ziet er normaal uit en glipt erdoor;
  // {{prijs}} valt meteen op.
  const filled = fillTemplate("Prijs: {{prijs}}", {});
  assert.match(filled, /\{\{prijs\}\}/);
});

test("what is still open can be listed and blocks the document", () => {
  const filled = fillTemplate("{{a}} en {{b}}", { a: "ja" });
  assert.deepEqual(missingPlaceholders(filled), ["b"]);
});

test("a fully filled document reports nothing missing", () => {
  const filled = fillTemplate("{{a}} en {{b}}", { a: "ja", b: "nee" });
  assert.deepEqual(missingPlaceholders(filled), []);
});

test("a template can say which keys it needs", () => {
  assert.deepEqual(templateKeys("{{naam}} {{adres}} {{naam}}"), ["adres", "naam"]);
});

test("document numbers are padded and carry the year", () => {
  assert.equal(formatDocumentNumber("MATO-CON", 2026, 1), "MATO-CON-2026-0001");
  assert.equal(formatDocumentNumber("MATO-CON", 2026, 42), "MATO-CON-2026-0042");
});

test("a counter past four digits is not truncated", () => {
  // Liever een langer nummer dan twee documenten die hetzelfde heten.
  assert.equal(formatDocumentNumber("X", 2026, 12345), "X-2026-12345");
});

test("each year gets its own counter", () => {
  assert.notEqual(sequenceId("MATO-CON", 2026), sequenceId("MATO-CON", 2027));
});

test("net plus VAT always equals gross to the cent", () => {
  // Bij afronden per post loopt dit uiteen en struikelt de boekhouding over
  // een cent.
  for (const net of [4200, 1, 0.01, 999.99, 1234.56, 3333.33]) {
    const { net: n, vat, gross } = priceBreakdown(net);
    assert.equal(
      Math.round(n * 100) + Math.round(vat * 100),
      Math.round(gross * 100),
      `mismatch at ${net}`
    );
  }
});

test("VAT on a round machine price is the expected 21 percent", () => {
  const { net, vat, gross } = priceBreakdown(4200);
  assert.equal(net, 4200);
  assert.equal(vat, 882);
  assert.equal(gross, 5082);
});

test("a free line still produces a valid breakdown", () => {
  assert.deepEqual(priceBreakdown(0), { net: 0, vat: 0, gross: 0 });
});

test("amounts in a document keep their cents", () => {
  // Op een dashboard mag afgerond worden, op een contract niet.
  assert.match(documentAmount(4200), /4\.200,00/);
});
