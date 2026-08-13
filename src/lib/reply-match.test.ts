import test from "node:test";
import assert from "node:assert/strict";
import { matchReplies, matchReply, normaliseAddress } from "./reply-match";
import { stripHtml, toIncoming } from "./graph";

function context(overrides: Partial<Parameters<typeof matchReply>[1]> = {}) {
  return {
    conversationLeads: new Map([["conv-1", "lead-bakkerij"]]),
    leadEmails: new Map([["info@zoetezonde.be", "lead-zonde"]]),
    knownMessageIds: new Set<string>(),
    ...overrides,
  };
}

test("a reply in our conversation lands on that lead", () => {
  const match = matchReply(
    { graphMessageId: "m1", conversationId: "conv-1", from: "iemand@elders.be" },
    context()
  );
  assert.deepEqual(match, {
    graphMessageId: "m1",
    leadId: "lead-bakkerij",
    reason: "gesprek",
  });
});

test("the conversation wins over the sender address", () => {
  // Antwoordt de zaakvoerder vanaf zijn persoonlijke adres, dan is het gesprek
  // het enige wat klopt.
  const match = matchReply(
    { graphMessageId: "m2", conversationId: "conv-1", from: "info@zoetezonde.be" },
    context()
  );
  assert.equal(match?.leadId, "lead-bakkerij");
});

test("a fresh mail from a known lead address still lands right", () => {
  const match = matchReply(
    { graphMessageId: "m3", conversationId: "conv-onbekend", from: "info@zoetezonde.be" },
    context()
  );
  assert.deepEqual(match, {
    graphMessageId: "m3",
    leadId: "lead-zonde",
    reason: "afzender",
  });
});

test("addresses match regardless of case or padding", () => {
  const match = matchReply(
    { graphMessageId: "m4", conversationId: null, from: "  INFO@ZoeteZonde.be " },
    context()
  );
  assert.equal(match?.leadId, "lead-zonde");
});

test("an unrelated mail is left alone", () => {
  // Nieuwsbrieven, facturen, privémail: die horen niet in het dossier van een
  // willekeurige bakkerij te belanden.
  assert.equal(
    matchReply(
      { graphMessageId: "m5", conversationId: null, from: "nieuws@krant.be" },
      context()
    ),
    null
  );
});

test("a message we already stored is not stored twice", () => {
  const match = matchReply(
    { graphMessageId: "m6", conversationId: "conv-1", from: "x@y.be" },
    context({ knownMessageIds: new Set(["m6"]) })
  );
  assert.equal(match, null);
});

test("the same message twice in one batch counts once", () => {
  const duplicate = { graphMessageId: "m7", conversationId: "conv-1", from: "x@y.be" };
  const matches = matchReplies([duplicate, duplicate], context());
  assert.equal(matches.length, 1);
});

test("a batch keeps only what belongs somewhere", () => {
  const matches = matchReplies(
    [
      { graphMessageId: "a", conversationId: "conv-1", from: "x@y.be" },
      { graphMessageId: "b", conversationId: null, from: "spam@elders.be" },
      { graphMessageId: "c", conversationId: null, from: "info@zoetezonde.be" },
    ],
    context()
  );
  assert.deepEqual(
    matches.map((m) => m.graphMessageId),
    ["a", "c"]
  );
});

test("an empty sender never matches an empty lead address", () => {
  // Een lead zonder mailadres mag geen magneet worden voor alles zonder afzender.
  const match = matchReply(
    { graphMessageId: "m8", conversationId: null, from: "" },
    context({ leadEmails: new Map([["", "lead-zonder-adres"]]) })
  );
  assert.equal(match, null);
});

test("normalising an address is idempotent", () => {
  assert.equal(normaliseAddress(" A@B.be "), "a@b.be");
  assert.equal(normaliseAddress(normaliseAddress(" A@B.be ")), "a@b.be");
});

test("an HTML reply becomes readable text", () => {
  const text = stripHtml(
    "<div>Dag Louis,</div><p>Graag meer info.<br>Groeten,&nbsp;Jan</p><style>p{color:red}</style>"
  );
  assert.ok(text.includes("Dag Louis,"));
  assert.ok(text.includes("Graag meer info."));
  assert.ok(text.includes("Groeten, Jan"));
  assert.ok(!text.includes("color:red"), "opmaak hoort er niet in te staan");
  assert.ok(!text.includes("<"), "geen tags meer over");
});

test("a Graph message maps onto the fields we store", () => {
  const incoming = toIncoming({
    id: "AAMk123",
    conversationId: "conv-9",
    subject: "Re: Automaat bij De Zoete Zonde",
    body: { contentType: "html", content: "<p>Bel me maandag.</p>" },
    from: { emailAddress: { address: "info@zoetezonde.be" } },
    toRecipients: [{ emailAddress: { address: "louis@matoautomaat.be" } }],
    receivedDateTime: "2026-08-12T09:30:00Z",
  });

  assert.equal(incoming.graphMessageId, "AAMk123");
  assert.equal(incoming.conversationId, "conv-9");
  assert.equal(incoming.from, "info@zoetezonde.be");
  assert.equal(incoming.to, "louis@matoautomaat.be");
  assert.equal(incoming.body, "Bel me maandag.");
  assert.equal(incoming.receivedAt.toISOString(), "2026-08-12T09:30:00.000Z");
});

test("a message without a subject or body still maps", () => {
  // Automatische antwoorden komen soms kaal binnen; dat mag de ronde niet breken.
  const incoming = toIncoming({ id: "AAMk999" });
  assert.equal(incoming.subject, "(geen onderwerp)");
  assert.equal(incoming.body, "");
  assert.equal(incoming.conversationId, null);
});
