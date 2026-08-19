import test from "node:test";
import assert from "node:assert/strict";
import {
  activityCounts,
  buildActivity,
  contactCount,
  readableDetail,
} from "./activity";

const EMPTY = { outreach: [], drafts: [], documents: [], audits: [] };

const at = (iso: string) => new Date(iso);

test("a logged call appears once, not twice", () => {
  // Het logboek registreert élke handeling, ook die waarvan het gesprek zelf al
  // bestaat. Zonder ontdubbelen staat elk telefoontje er dubbel op.
  const items = buildActivity({
    ...EMPTY,
    outreach: [
      {
        id: "o1",
        createdAt: at("2026-08-11T10:00:00Z"),
        type: "CALL",
        outcome: "INTERESTED",
        note: "Wil offerte",
        createdBy: { name: "Jonas" },
      },
    ],
    audits: [
      {
        id: "a1",
        createdAt: at("2026-08-11T10:00:01Z"),
        action: "call.logged",
        detail: '{"outcome":"INTERESTED"}',
        actor: { name: "Jonas" },
      },
    ],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "call");
});

test("the call keeps its outcome in Dutch and its note", () => {
  const [item] = buildActivity({
    ...EMPTY,
    outreach: [
      {
        id: "o1",
        createdAt: at("2026-08-11T10:00:00Z"),
        type: "CALL",
        outcome: "NO_ANSWER",
        note: "Rond 14u opnieuw",
        createdBy: { name: "Jonas" },
      },
    ],
  });
  assert.match(item.title, /Gebeld/);
  assert.ok(!item.title.includes("NO_ANSWER"));
  assert.equal(item.detail, "Rond 14u opnieuw");
  assert.equal(item.actor, "Jonas");
});

test("newest first, across all four sources", () => {
  const items = buildActivity({
    outreach: [
      { id: "o", createdAt: at("2026-08-01T09:00:00Z"), type: "CALL", outcome: null, note: null },
    ],
    drafts: [
      { id: "d", createdAt: at("2026-08-03T09:00:00Z"), subject: "Voorstel", status: "PREPARED" },
    ],
    documents: [
      {
        id: "g",
        createdAt: at("2026-08-04T09:00:00Z"),
        number: "MATO-VK-2026-0001",
        title: "Contract",
        status: "READY",
        signerName: null,
      },
    ],
    audits: [
      { id: "a", createdAt: at("2026-08-02T09:00:00Z"), action: "lead.taken", detail: null },
    ],
  });
  assert.deepEqual(
    items.map((i) => i.kind),
    ["document", "mail", "lead", "call"]
  );
});

test("audit actions are shown in plain language", () => {
  const [item] = buildActivity({
    ...EMPTY,
    audits: [
      { id: "a", createdAt: at("2026-08-02T09:00:00Z"), action: "lead.taken", detail: null },
    ],
  });
  assert.equal(item.title, "Op naam gezet");
});

test("an unknown action keeps its raw name rather than vanishing", () => {
  // Een gat in de geschiedenis is erger dan een lelijke regel.
  const [item] = buildActivity({
    ...EMPTY,
    audits: [
      { id: "a", createdAt: at("2026-08-02T09:00:00Z"), action: "iets.nieuws", detail: null },
    ],
  });
  assert.equal(item.title, "iets.nieuws");
});

test("stored JSON detail becomes readable instead of raw", () => {
  assert.equal(readableDetail('{"previousStatus":"NEW"}'), "was: NEW");
  assert.equal(readableDetail('{"value":4200,"product":"Snack Pro 6"}'), "bedrag: 4200 · product: Snack Pro 6");
});

test("internal ids are kept in the log but stay off the screen", () => {
  // "dealId: cmsos0e88000g6ywv0vjctfe5" zegt een mens niets.
  assert.equal(
    readableDetail('{"dealId":"cmsos0e88000g6ywv0vjctfe5","value":4200}'),
    "bedrag: 4200"
  );
  assert.equal(readableDetail('{"to":"cmsors2fq00036ywvwigxckpo"}'), null);
  // Ook als de sleutel niet naar een id klinkt maar er wel een bevat.
  assert.equal(readableDetail('{"iets":"cmsors2fq00036ywvwigxckpo"}'), null);
});

test("empty or unparseable detail does not produce noise", () => {
  assert.equal(readableDetail(null), null);
  assert.equal(readableDetail("{}"), null);
  assert.equal(readableDetail('{"to":null}'), null);
  assert.equal(readableDetail("gewoon tekst"), "gewoon tekst");
});

test("a signed contract names its signer", () => {
  const [item] = buildActivity({
    ...EMPTY,
    documents: [
      {
        id: "g",
        createdAt: at("2026-08-04T09:00:00Z"),
        number: "MATO-VK-2026-0001",
        title: "Contract",
        status: "SIGNED",
        signerName: "Jan Delecta",
      },
    ],
  });
  assert.match(item.title, /getekend/);
  assert.match(item.detail ?? "", /Jan Delecta/);
});

test("counts are per kind and add up to the total", () => {
  const items = buildActivity({
    outreach: [
      { id: "o1", createdAt: at("2026-08-01T09:00:00Z"), type: "CALL", outcome: null, note: null },
      { id: "o2", createdAt: at("2026-08-02T09:00:00Z"), type: "CALL", outcome: null, note: null },
    ],
    drafts: [
      { id: "d", createdAt: at("2026-08-03T09:00:00Z"), subject: "x", status: "PREPARED" },
    ],
    documents: [],
    audits: [],
  });
  const counts = activityCounts(items);
  assert.equal(counts.call, 2);
  assert.equal(counts.mail, 1);
  assert.equal(counts.document, 0);
  assert.equal(
    Object.values(counts).reduce((sum, n) => sum + n, 0),
    items.length
  );
});

test("a sent draft appears once, as the message that actually left", () => {
  // Het concept blijft in de database staan, maar de verstuurde mail vertelt
  // hetzelfde met adres en tekst erbij. Allebei tonen leest als twee mails.
  const items = buildActivity({
    ...EMPTY,
    drafts: [
      {
        id: "d1",
        createdAt: at("2026-08-03T09:00:00Z"),
        subject: "Automaat bij De Zoete Zonde",
        status: "SENT",
      },
    ],
    mail: [
      {
        id: "m1",
        occurredAt: at("2026-08-03T09:05:00Z"),
        direction: "OUT",
        subject: "Automaat bij De Zoete Zonde",
        body: "Dag Jan, ik zag dat u afhaalmaaltijden verkoopt.",
        fromAddress: "louis@matoautomaat.be",
        toAddress: "info@zoetezonde.be",
        user: { name: "Louis" },
      },
    ],
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "sent");
  assert.match(items[0].detail ?? "", /info@zoetezonde\.be/);
});

test("an unsent draft still shows, so nobody forgets it is waiting", () => {
  const items = buildActivity({
    ...EMPTY,
    drafts: [
      { id: "d2", createdAt: at("2026-08-03T09:00:00Z"), subject: "Klaar", status: "PREPARED" },
    ],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "mail");
});

test("a reply is contact, a waiting draft is not", () => {
  // "3 contacten" op de fiche moet betekenen dat er drie keer echt iets
  // gebeurd is — niet dat er een tekst klaarstaat die nog niemand gezien heeft.
  const items = buildActivity({
    ...EMPTY,
    drafts: [
      { id: "d3", createdAt: at("2026-08-01T09:00:00Z"), subject: "Klaar", status: "PREPARED" },
    ],
    mail: [
      {
        id: "m2",
        occurredAt: at("2026-08-02T09:00:00Z"),
        direction: "OUT",
        subject: "Voorstel",
        body: "…",
        fromAddress: "louis@matoautomaat.be",
        toAddress: "info@zoetezonde.be",
      },
      {
        id: "m3",
        occurredAt: at("2026-08-03T09:00:00Z"),
        direction: "IN",
        subject: "Re: Voorstel",
        body: "Bel me maandag.",
        fromAddress: "info@zoetezonde.be",
        toAddress: "louis@matoautomaat.be",
      },
    ],
  });

  assert.equal(contactCount(items), 2);
  const counts = activityCounts(items);
  assert.equal(counts.sent, 1);
  assert.equal(counts.reply, 1);
  assert.equal(counts.mail, 1);
});

test("an incoming reply names the sender, not the recipient", () => {
  const [item] = buildActivity({
    ...EMPTY,
    mail: [
      {
        id: "m4",
        occurredAt: at("2026-08-03T09:00:00Z"),
        direction: "IN",
        subject: "Re: Voorstel",
        body: "Graag een afspraak volgende week.",
        fromAddress: "info@zoetezonde.be",
        toAddress: "louis@matoautomaat.be",
      },
    ],
  });
  assert.equal(item.title, "Antwoord ontvangen");
  assert.match(item.detail ?? "", /van info@zoetezonde\.be/);
  assert.match(item.detail ?? "", /afspraak volgende week/);
});

test("a very long mail is shortened on the timeline", () => {
  const [item] = buildActivity({
    ...EMPTY,
    mail: [
      {
        id: "m5",
        occurredAt: at("2026-08-03T09:00:00Z"),
        direction: "IN",
        subject: "Re: Voorstel",
        body: "x".repeat(5000),
        fromAddress: "info@zoetezonde.be",
        toAddress: "louis@matoautomaat.be",
      },
    ],
  });
  assert.ok((item.detail ?? "").length < 300, "de tijdlijn mag niet volgestort worden");
  assert.match(item.detail ?? "", /…$/);
});

test("email visit and note get their own labels", () => {
  const items = buildActivity({
    ...EMPTY,
    outreach: [
      {
        id: "e",
        createdAt: at("2026-08-11T10:00:00Z"),
        type: "EMAIL",
        outcome: "SENT",
        note: null,
        createdBy: { name: "Jonas" },
      },
      {
        id: "v",
        createdAt: at("2026-08-10T10:00:00Z"),
        type: "VISIT",
        outcome: "INTERESTED",
        note: "Was open",
        createdBy: { name: "Jonas" },
      },
      {
        id: "n",
        createdAt: at("2026-08-09T10:00:00Z"),
        type: "NOTE",
        outcome: null,
        note: "Terugbellen na Pasen",
        createdBy: { name: "Jonas" },
      },
    ],
  });
  assert.equal(items[0].title, "Gemaild — Verstuurd");
  assert.equal(items[0].kind, "email");
  assert.equal(items[1].title, "Bezocht — Interesse");
  assert.equal(items[1].kind, "visit");
  assert.equal(items[2].title, "Notitie");
  assert.equal(items[2].kind, "note");
  assert.equal(items[2].detail, "Terugbellen na Pasen");
});

test("a lead with no history yields an empty timeline, not a crash", () => {
  assert.deepEqual(buildActivity(EMPTY), []);
});

test("an open task is not on the timeline, only completed or cancelled ones", () => {
  // De takenlijst toont wat nog moet gebeuren; de geschiedenis toont wat er
  // gebeurd is. Een open taak op de tijdlijn zou hetzelfde ding twee keer
  // tonen, één keer als "nog te doen" en één keer als "gebeurtenis".
  const items = buildActivity({
    ...EMPTY,
    tasks: [
      {
        id: "t1",
        title: "Check-in na een maand",
        status: "OPEN",
        completedAt: null,
        updatedAt: at("2026-08-01T09:00:00Z"),
      },
    ],
  });
  assert.equal(items.length, 0);
});

test("a completed task shows on the timeline at its completion time", () => {
  const [item] = buildActivity({
    ...EMPTY,
    tasks: [
      {
        id: "t2",
        title: "Nazorg — eerste week",
        status: "DONE",
        completedAt: at("2026-08-10T14:00:00Z"),
        updatedAt: at("2026-08-10T14:00:00Z"),
        assignedTo: { name: "Jonas" },
      },
    ],
  });
  assert.equal(item.kind, "task");
  assert.equal(item.title, "Taak afgerond");
  assert.equal(item.detail, "Nazorg — eerste week");
  assert.equal(item.actor, "Jonas");
  assert.equal(item.at.toISOString(), "2026-08-10T14:00:00.000Z");
});

test("a cancelled task is labelled differently from a completed one", () => {
  const [item] = buildActivity({
    ...EMPTY,
    tasks: [
      {
        id: "t3",
        title: "Opvolgen — geen reactie",
        status: "CANCELLED",
        completedAt: null,
        updatedAt: at("2026-08-11T09:00:00Z"),
      },
    ],
  });
  assert.equal(item.title, "Taak geannuleerd");
});

test("the audit-log fallback for a task action is suppressed by the richer task entry", () => {
  // Zonder deze ontdubbeling staat elke afgeronde taak twee keer op de
  // tijdlijn: één keer via het taken-object, één keer als kale audit-regel.
  const items = buildActivity({
    ...EMPTY,
    tasks: [
      {
        id: "t4",
        title: "Kwartaalcheck",
        status: "DONE",
        completedAt: at("2026-08-12T09:00:00Z"),
        updatedAt: at("2026-08-12T09:00:00Z"),
      },
    ],
    audits: [
      {
        id: "a1",
        createdAt: at("2026-08-12T09:00:00Z"),
        action: "task.completed",
        detail: null,
      },
    ],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].id, "task-t4");
});

test("task counts show up in activityCounts", () => {
  const items = buildActivity({
    ...EMPTY,
    tasks: [
      {
        id: "t5",
        title: "x",
        status: "DONE",
        completedAt: at("2026-08-01T09:00:00Z"),
        updatedAt: at("2026-08-01T09:00:00Z"),
      },
    ],
  });
  assert.equal(activityCounts(items).task, 1);
});
