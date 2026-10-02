import test from "node:test";
import assert from "node:assert/strict";
import {
  businessDomain,
  buildDomainIndex,
  matchReplies,
  matchReply,
  normaliseAddress,
  shouldKeepUnmatched,
  type MatchContext,
  type MatchTarget,
} from "./reply-match";
import { stripHtml, toIncoming } from "./graph";

function target(leadId: string, customerId?: string | null): MatchTarget {
  return { leadId, customerId: customerId ?? null };
}

function context(overrides: Partial<MatchContext> = {}): MatchContext {
  return {
    conversationLeads: new Map([["conv-1", target("lead-bakkerij")]]),
    leadEmails: new Map([["info@zoetezonde.be", target("lead-zonde")]]),
    customerEmails: new Map([
      ["boekhouding@cafecentral.be", { customerId: "cust-central", leadId: null }],
    ]),
    domains: buildDomainIndex([
      { email: "info@zoetezonde.be", target: target("lead-zonde") },
      {
        email: "boekhouding@cafecentral.be",
        target: { customerId: "cust-central", leadId: null },
      },
    ]),
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
    customerId: null,
    reason: "gesprek",
    confidence: 1,
  });
});

test("the conversation wins over the sender address", () => {
  const match = matchReply(
    { graphMessageId: "m2", conversationId: "conv-1", from: "info@zoetezonde.be" },
    context()
  );
  assert.equal(match?.leadId, "lead-bakkerij");
  assert.equal(match?.reason, "gesprek");
});

test("a fresh mail from a known lead address still lands right", () => {
  const match = matchReply(
    { graphMessageId: "m3", conversationId: "conv-onbekend", from: "info@zoetezonde.be" },
    context()
  );
  assert.equal(match?.leadId, "lead-zonde");
  assert.equal(match?.reason, "afzender");
});

test("a customer email matches without an open lead", () => {
  const match = matchReply(
    {
      graphMessageId: "m-cust",
      conversationId: null,
      from: "boekhouding@cafecentral.be",
    },
    context()
  );
  assert.equal(match?.customerId, "cust-central");
  assert.equal(match?.leadId, null);
  assert.equal(match?.reason, "klant");
});

test("sent mail matches on the recipient, not the sender", () => {
  const match = matchReply(
    {
      graphMessageId: "m-out",
      conversationId: null,
      from: "louis@matoautomaat.be",
      to: "info@zoetezonde.be",
      direction: "OUT",
    },
    context()
  );
  assert.equal(match?.leadId, "lead-zonde");
  assert.equal(match?.reason, "afzender");
});

test("a unique business domain matches when the exact address is unknown", () => {
  const match = matchReply(
    {
      graphMessageId: "m-dom",
      conversationId: null,
      from: "jan@zoetezonde.be",
    },
    context()
  );
  assert.equal(match?.leadId, "lead-zonde");
  assert.equal(match?.reason, "domein");
  assert.ok((match?.confidence ?? 0) < 0.9);
});

test("an ambiguous domain does not guess", () => {
  const match = matchReply(
    { graphMessageId: "m-amb", conversationId: null, from: "x@shared.be" },
    context({
      domains: buildDomainIndex([
        { email: "a@shared.be", target: target("lead-a") },
        { email: "b@shared.be", target: target("lead-b") },
      ]),
    })
  );
  assert.equal(match, null);
});

test("consumer domains never match by domain", () => {
  assert.equal(businessDomain("jan@gmail.com"), null);
  assert.equal(businessDomain("info@telenet.be"), null);
  const match = matchReply(
    { graphMessageId: "m-g", conversationId: null, from: "jan@gmail.com" },
    context({
      domains: new Map([
        ["gmail.com", [target("lead-wrong")]],
      ]),
    })
  );
  assert.equal(match, null);
});

test("addresses match regardless of case or padding", () => {
  const match = matchReply(
    { graphMessageId: "m4", conversationId: null, from: "  INFO@ZoeteZonde.be " },
    context()
  );
  assert.equal(match?.leadId, "lead-zonde");
});

test("an unrelated mail is left alone", () => {
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
  const match = matchReply(
    { graphMessageId: "m8", conversationId: null, from: "" },
    context({ leadEmails: new Map([["", target("lead-zonder-adres")]]) })
  );
  assert.equal(match, null);
});

test("normalising an address is idempotent", () => {
  assert.equal(normaliseAddress(" A@B.be "), "a@b.be");
  assert.equal(normaliseAddress(normaliseAddress(" A@B.be ")), "a@b.be");
});

test("shouldKeepUnmatched keeps sent mail and CRM-domain inbox mail", () => {
  const domains = new Set(["zoetezonde.be"]);
  assert.equal(
    shouldKeepUnmatched(
      {
        direction: "OUT",
        from: "louis@mato.be",
        to: "onbekend@ergens.be",
        subject: "Hallo",
        conversationId: null,
      },
      domains
    ),
    true
  );
  assert.equal(
    shouldKeepUnmatched(
      {
        direction: "IN",
        from: "nieuws@newsletter.com",
        to: "louis@mato.be",
        subject: "Weekaanbieding",
        conversationId: null,
      },
      domains
    ),
    false
  );
  assert.equal(
    shouldKeepUnmatched(
      {
        direction: "IN",
        from: "piet@zoetezonde.be",
        to: "louis@mato.be",
        subject: "Vraag",
        conversationId: null,
      },
      domains
    ),
    true
  );
  assert.equal(
    shouldKeepUnmatched(
      {
        direction: "IN",
        from: "x@y.be",
        to: "louis@mato.be",
        subject: "Re: Automaat",
        conversationId: null,
      },
      domains
    ),
    true
  );
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
  assert.equal(incoming.folder, "inbox");
  assert.equal(incoming.receivedAt.toISOString(), "2026-08-12T09:30:00.000Z");
});

test("sent Graph messages use sentDateTime", () => {
  const incoming = toIncoming(
    {
      id: "AAMkSent",
      subject: "Voorstel",
      from: { emailAddress: { address: "louis@mato.be" } },
      toRecipients: [{ emailAddress: { address: "info@zaak.be" } }],
      sentDateTime: "2026-09-01T14:00:00Z",
    },
    "sentitems"
  );
  assert.equal(incoming.folder, "sentitems");
  assert.equal(incoming.receivedAt.toISOString(), "2026-09-01T14:00:00.000Z");
});

test("a message without a subject or body still maps", () => {
  const incoming = toIncoming({ id: "AAMk999" });
  assert.equal(incoming.subject, "(geen onderwerp)");
  assert.equal(incoming.body, "");
  assert.equal(incoming.conversationId, null);
});
