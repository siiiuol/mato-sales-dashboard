import test from "node:test";
import assert from "node:assert/strict";
import {
  checkTemplateUsable,
  extractTokens,
  formatDocumentNumber,
  hasBlockers,
  needsExternalReview,
  renderTemplate,
  sequenceId,
  validateDocument,
} from "./documents";

const APPROVED = { status: "LEGAL_APPROVED" as const };

test("document numbers are zero-padded and prefixed (§43)", () => {
  assert.equal(formatDocumentNumber("Q", 2026, 1), "MATO-Q-2026-0001");
  assert.equal(formatDocumentNumber("CON", 2026, 42), "MATO-CON-2026-0042");
  assert.equal(formatDocumentNumber("po", 2026, 1234), "MATO-PO-2026-1234");
});

test("sequence ids separate prefix and year", () => {
  assert.equal(sequenceId("Q", 2026), "Q-2026");
  assert.notEqual(sequenceId("Q", 2026), sequenceId("Q", 2027));
});

test("expired and blocked templates cannot be used (§40.1)", () => {
  assert.equal(checkTemplateUsable({ status: "EXPIRED" }).usable, false);
  assert.equal(checkTemplateUsable({ status: "BLOCKED" }).usable, false);
  assert.equal(checkTemplateUsable({ status: "SUPERSEDED" }).usable, false);
  assert.equal(checkTemplateUsable({ status: "DRAFT" }).usable, false);
  assert.equal(checkTemplateUsable(APPROVED).usable, true);
});

test("a template overdue for review is not usable", () => {
  const past = new Date("2020-01-01");
  const result = checkTemplateUsable({ status: "LEGAL_APPROVED", reviewAt: past });
  assert.equal(result.usable, false);
  assert.match(result.reason ?? "", /review/i);
});

test("a template not yet effective is not usable", () => {
  const future = new Date(Date.now() + 86400000);
  const result = checkTemplateUsable({ status: "LEGAL_APPROVED", effectiveAt: future });
  assert.equal(result.usable, false);
});

test("tokens are extracted and filled from context", () => {
  const body = "Offer for {{customer.name}} in {{customer.city}}.";
  assert.deepEqual(extractTokens(body).sort(), ["customer.city", "customer.name"]);
  const { body: out, missing } = renderTemplate(body, {
    customer: { name: "Bakkerij Dult", city: "Gent" },
  });
  assert.equal(out, "Offer for Bakkerij Dult in Gent.");
  assert.deepEqual(missing, []);
});

test("missing values stay visible instead of silently blanking", () => {
  const { body, missing } = renderTemplate("VAT: {{customer.vat}}", { customer: {} });
  assert.equal(body, "VAT: «customer.vat»");
  assert.deepEqual(missing, ["customer.vat"]);
});

test("empty required fields block approval (§42)", () => {
  const issues = validateDocument({
    template: APPROVED,
    requiredFields: ["customer.vat"],
    context: { customer: { name: "X" } },
    missingTokens: [],
    clauses: [],
  });
  assert.equal(hasBlockers(issues), true);
  assert.equal(issues[0].field, "customer.vat");
});

test("draft and expired clauses block approval", () => {
  const draft = validateDocument({
    template: APPROVED,
    requiredFields: [],
    context: {},
    missingTokens: [],
    clauses: [{ code: "PAY-01", status: "DRAFT", mandatory: true, text: "..." }],
  });
  assert.equal(hasBlockers(draft), true);

  const expired = validateDocument({
    template: APPROVED,
    requiredFields: [],
    context: {},
    missingTokens: [],
    clauses: [{ code: "PAY-01", status: "EXPIRED", mandatory: true, text: "..." }],
  });
  assert.equal(hasBlockers(expired), true);
});

test("a clause with no text in the chosen language blocks approval", () => {
  const issues = validateDocument({
    template: APPROVED,
    requiredFields: [],
    context: {},
    missingTokens: [],
    clauses: [{ code: "WAR-01", status: "LEGAL_APPROVED", mandatory: true, text: "   " }],
  });
  assert.equal(hasBlockers(issues), true);
});

test("a missing mandatory clause blocks approval", () => {
  const issues = validateDocument({
    template: APPROVED,
    requiredFields: [],
    context: {},
    missingTokens: [],
    clauses: [],
    mandatoryClauseCodes: ["LAW-01"],
  });
  assert.equal(hasBlockers(issues), true);
  assert.match(issues[0].message, /Mandatory clause LAW-01/);
});

test("unfilled placeholders warn but do not block", () => {
  const issues = validateDocument({
    template: APPROVED,
    requiredFields: [],
    context: {},
    missingTokens: ["customer.website"],
    clauses: [],
  });
  assert.equal(hasBlockers(issues), false);
  assert.equal(issues[0].severity, "WARNING");
});

test("a clean document produces no issues", () => {
  const issues = validateDocument({
    template: APPROVED,
    requiredFields: ["customer.name"],
    context: { customer: { name: "Bakkerij Dult" } },
    missingTokens: [],
    clauses: [{ code: "PAY-01", status: "LEGAL_APPROVED", mandatory: true, text: "Betaling..." }],
  });
  assert.deepEqual(issues, []);
});

test("edited clauses and high risk force external review (§41)", () => {
  assert.equal(
    needsExternalReview({
      clauses: [{ riskLevel: "LOW", edited: true }],
      templateStatus: "LEGAL_APPROVED",
    }).required,
    true
  );
  assert.equal(
    needsExternalReview({
      clauses: [{ riskLevel: "HIGH" }],
      templateStatus: "LEGAL_APPROVED",
    }).required,
    true
  );
});

test("internal-only approval still requires external review", () => {
  const result = needsExternalReview({ clauses: [], templateStatus: "MATO_APPROVED" });
  assert.equal(result.required, true);
  assert.match(result.reason ?? "", /internal approval only/i);
});

test("large discounts and high contract values require review", () => {
  assert.equal(
    needsExternalReview({ clauses: [], templateStatus: "LEGAL_APPROVED", discountPercent: 25 })
      .required,
    true
  );
  assert.equal(
    needsExternalReview({ clauses: [], templateStatus: "LEGAL_APPROVED", totalValueEur: 60000 })
      .required,
    true
  );
  assert.equal(
    needsExternalReview({ clauses: [], templateStatus: "LEGAL_APPROVED", totalValueEur: 1000 })
      .required,
    false
  );
});
