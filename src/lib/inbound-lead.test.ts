import test from "node:test";
import assert from "node:assert/strict";
import {
  decideInbound,
  inboundDisplayName,
  inboundNotes,
} from "./inbound-lead";

const base = {
  name: "Jan Peeters",
  email: "jan@bakkerij.be",
  phone: "0470123456",
  city: "Gent",
};

test("unknown contact becomes a new lead", () => {
  assert.deepEqual(decideInbound(base, []), { action: "create" });
});

test("exact email links to the existing lead", () => {
  const decision = decideInbound(base, [
    {
      id: "lead-1",
      kind: "lead",
      email: "JAN@bakkerij.be",
      phone: null,
    },
  ]);
  assert.deepEqual(decision, {
    action: "link",
    candidateId: "lead-1",
    kind: "lead",
    leadId: "lead-1",
  });
});

test("exact phone links even when email differs", () => {
  const decision = decideInbound(
    { ...base, email: "ander@adres.be" },
    [
      {
        id: "lead-2",
        kind: "lead",
        email: "oud@adres.be",
        phone: "+32 470 12 34 56",
      },
    ]
  );
  assert.equal(decision.action, "link");
  if (decision.action === "link") assert.equal(decision.leadId, "lead-2");
});

test("two different hits go to triage instead of guessing", () => {
  const decision = decideInbound(base, [
    { id: "a", kind: "lead", email: "jan@bakkerij.be", phone: null },
    { id: "b", kind: "lead", email: null, phone: "0470123456" },
  ]);
  assert.equal(decision.action, "triage");
});

test("a customer without an open lead goes to triage", () => {
  const decision = decideInbound(base, [
    {
      id: "cust-1",
      kind: "customer",
      email: "jan@bakkerij.be",
      phone: null,
      leadId: null,
    },
  ]);
  assert.equal(decision.action, "triage");
});

test("a customer with an open lead links to that lead", () => {
  const decision = decideInbound(base, [
    {
      id: "cust-1",
      kind: "customer",
      email: "jan@bakkerij.be",
      phone: null,
      leadId: "lead-open",
      status: "CONTACTED",
    },
  ]);
  assert.deepEqual(decision, {
    action: "link",
    candidateId: "cust-1",
    kind: "customer",
    leadId: "lead-open",
  });
});

test("display name prefers company with contact in parentheses", () => {
  assert.equal(
    inboundDisplayName({ name: "Jan", company: "Bakkerij Zoet" }),
    "Bakkerij Zoet (Jan)"
  );
  assert.equal(inboundDisplayName({ name: "Jan" }), "Jan");
});

test("inbound notes keep the message", () => {
  const notes = inboundNotes({
    name: "Jan",
    company: "Zoet",
    message: "Graag info over huur.",
  });
  assert.match(notes, /website/i);
  assert.match(notes, /Zoet/);
  assert.match(notes, /huur/);
});
