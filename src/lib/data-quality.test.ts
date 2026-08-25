import assert from "node:assert/strict";
import test from "node:test";
import { summarizeLeadQuality, type QualityLead } from "./data-quality";

const now = new Date("2026-08-24T10:00:00.000Z");

function lead(overrides: Partial<QualityLead> = {}): QualityLead {
  return {
    id: "lead",
    name: "Bakkerij",
    status: "TO_CALL",
    ownerId: null,
    nextActionAt: null,
    lastTouchedAt: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    complianceStatus: "CLEARED",
    phone: null,
    email: null,
    ...overrides,
  };
}

test("datakwaliteit telt alleen open leads voor opvolgproblemen", () => {
  const quality = summarizeLeadQuality(
    [
      lead(),
      lead({ id: "won", status: "WON" }),
      lead({
        id: "complete",
        ownerId: "user",
        phone: "051123456",
        nextActionAt: new Date("2026-08-25T00:00:00.000Z"),
        lastTouchedAt: new Date("2026-08-23T00:00:00.000Z"),
      }),
    ],
    now
  );
  assert.equal(quality.missingContact, 1);
  assert.equal(quality.ownerless, 1);
  assert.equal(quality.withoutNextAction, 1);
  assert.equal(quality.stale, 1);
});

test("pending triage en dubbele telefoonnummers worden zichtbaar", () => {
  const quality = summarizeLeadQuality(
    [
      lead({
        id: "a",
        status: "NEW",
        complianceStatus: "PENDING",
        phone: "051 12 34 56",
      }),
      lead({ id: "b", name: "Bakkerij B", phone: "+32 51 12 34 56" }),
    ],
    now
  );
  assert.equal(quality.pendingTriage, 1);
  assert.equal(quality.duplicatePairs.length, 1);
});
