import assert from "node:assert/strict";
import test from "node:test";
import { buildCallQueueWhere } from "./call-queue";

test("belwachtrij sluit blokkades uit en gebruikt een vaste daggrens", () => {
  const now = new Date("2026-08-24T10:00:00.000Z");
  const where = buildCallQueueWhere("user-1", now);
  assert.equal(where.doNotContact, false);
  assert.equal(where.complianceStatus, "CLEARED");
  assert.deepEqual(where.status.in, [
    "NEW",
    "TO_CALL",
    "FOLLOW_UP",
    "CONTACTED",
  ]);
  assert.deepEqual(where.AND[0], {
    OR: [
      { nextActionAt: { lt: new Date("2026-08-25T00:00:00.000Z") } },
      { nextActionAt: null },
    ],
  });
});

test("belwachtrij houdt rekening met claims en eigenaarschap", () => {
  const where = buildCallQueueWhere(
    "user-1",
    new Date("2026-08-24T10:00:00.000Z")
  );
  assert.equal(where.AND.length, 3);
});
