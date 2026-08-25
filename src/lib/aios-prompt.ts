import { categoryLabel } from "./constants";
import { catalogPromptBlock, suggestMachineHint } from "./mato-catalog";
import { angleFor, leadFacts, type MailLead } from "./mail-prompt";

/**
 * Opdrachten voor de Assistent in MATO OS.
 *
 * Zelfde strengheid als mail: alleen feiten, Vlaams Nederlands, pad naar
 * koop of huur — nooit AI-gedoe als verkoopargument.
 */

export const AIOS_SYSTEM = `Je bent de verkoopassistent van MATO Automaat (matoautomaat.be).
MATO verkoopt automaten (B1/M1/S1 lift, C1 val, F1 diepvries, L1 locker, T1 touch) plus behuizing/wrapping, verpakking, betaalterminals en telemetrie,
en/of werkt met productpartners in de Automatenshop Diksmuide.

Regels:
- Vlaams Nederlands. Spreek de zaak aan met "u" in klantgerichte tekst.
- Interne briefs mag je direct en kort houden.
- Gebruik uitsluitend de feiten die je krijgt. Verzin geen prijzen, omzet, openingsuren of referenties.
- Modelnamen alleen uit de catalogusfeiten. Geen "Snack Pro" of andere verzonnen merken.
- Benoem altijd het deal-type: koop, huur (shop-partner), of beide opties.
- Doel: de volgende stap naar een gesloten deal, niet een AI-demo.
- Geen superlatieven, geen uitroeptekens.`;

export type AiosLead = MailLead & {
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  lastNote?: string | null;
  nextActionAt?: string | null;
};

export function leadBlock(lead: AiosLead): string {
  const lines = [
    ...leadFacts(lead).map((f) => `- ${f}`),
    lead.phone ? `- Telefoon: ${lead.phone}` : null,
    lead.email ? `- E-mail: ${lead.email}` : null,
    lead.status ? `- Status in CRM: ${lead.status}` : null,
    lead.nextActionAt ? `- Volgende actie: ${lead.nextActionAt}` : null,
    lead.lastNote ? `- Laatste notitie: ${lead.lastNote}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export const BRIEF_SCHEMA = {
  type: "object",
  properties: {
    dealPath: {
      type: "string",
      description: "koop, huur of beide",
    },
    angle: { type: "string", description: "Eén primaire invalshoek" },
    questions: {
      type: "string",
      description: "Vijf discovery-vragen, genummerd, met regeleindes",
    },
    objections: {
      type: "string",
      description: "Waarschijnlijke bezwaren en feitelijke antwoorden",
    },
    nextStep: {
      type: "string",
      description: "Concrete volgende stap (bellen, mailen, bezoek)",
    },
    markdown: {
      type: "string",
      description: "Volledige brief in markdown voor op het scherm",
    },
  },
  required: ["dealPath", "angle", "questions", "objections", "nextStep", "markdown"],
  additionalProperties: false,
} as const;

export function buildBriefPrompt(lead: AiosLead, senderName: string): string {
  return [
    `Maak een pre-contact zaak-audit brief voor ${senderName}.`,
    "",
    "Feiten:",
    leadBlock(lead),
    "",
    `Invalshoek-hint: ${angleFor(lead)}`,
    "",
    "In markdown: feiten, aanbevolen pad (koop/huur/beide), 5 vragen, bezwaren, volgende stap.",
    "Vul dealPath met precies: koop, huur of beide.",
  ].join("\n");
}

export const VOORSTEL_SCHEMA = {
  type: "object",
  properties: {
    dealPath: { type: "string", description: "koop, huur of beide" },
    title: { type: "string", description: "Korte titel van het voorstel" },
    markdown: {
      type: "string",
      description: "Volledig voorstel in markdown (optie koop en/of huur)",
    },
    nextStep: { type: "string", description: "Vraag om akkoord / bezoek / demo" },
  },
  required: ["dealPath", "title", "markdown", "nextStep"],
  additionalProperties: false,
} as const;

export function buildVoorstelPrompt(
  lead: AiosLead,
  senderName: string,
  products: Array<{
    name: string;
    line: string;
    listPrice: number;
    description?: string | null;
  }>
): string {
  return [
    `Schrijf een commercieel voorstel-concept voor ${lead.name} namens MATO, opgesteld door ${senderName}.`,
    "",
    "Feiten:",
    leadBlock(lead),
    "",
    `Machinehint: ${suggestMachineHint(lead)}`,
    "",
    "Productcatalogus:",
    catalogPromptBlock(products),
    "",
    "Structuur in markdown:",
    "1. Aanleiding",
    "2. Aanbevolen pad (koop vs productpartner shop)",
    "3. Optie A — Koop (passend model uit catalogus)",
    "4. Optie B — Productpartner / shop Diksmuide (formule A/B/C — placeholders als onbekend)",
    "5. Wat MATO regelt vs de zaak",
    "6. Volgende stap",
    "",
    "Geen verzonnen ROI. Prijzen alleen als ze in de catalogus staan of [PRIJS BEVESTIGEN].",
  ].join("\n");
}

export type OchtendLeadRow = {
  name: string;
  city: string | null;
  category: string | null;
  status: string;
  phone: string | null;
  nextActionAt: string | null;
  lastContact: string | null;
  hasVending: boolean;
  nearbyVending: number;
  sellsTakeaway: boolean;
};

export type OchtendTaskRow = {
  title: string;
  dueAt: string | null;
  leadName: string | null;
};

export const OCHTENDBRIEF_SCHEMA = {
  type: "object",
  properties: {
    focus: {
      type: "string",
      description: "Max 5 acties vandaag, genummerd, die naar koop/huur close leiden",
    },
    markdown: {
      type: "string",
      description: "Volledige ochtendbrief in markdown",
    },
  },
  required: ["focus", "markdown"],
  additionalProperties: false,
} as const;

export function buildOchtendbriefPrompt(input: {
  senderName: string;
  leads: OchtendLeadRow[];
  tasks: OchtendTaskRow[];
}): string {
  const leadLines = input.leads.map((l) => {
    const cat = l.category ? categoryLabel(l.category) : "?";
    const signals = [
      l.hasVending ? "heeft automaat" : null,
      l.nearbyVending > 0 ? `${l.nearbyVending} in buurt` : null,
      l.sellsTakeaway ? "afhaal" : null,
    ]
      .filter(Boolean)
      .join(", ");
    return `- ${l.name} (${l.city ?? "?"}, ${cat}) · ${l.status} · tel ${l.phone ?? "geen"} · actie ${l.nextActionAt ?? "—"} · contact ${l.lastContact ?? "—"} · ${signals || "geen extra signalen"}`;
  });

  const taskLines =
    input.tasks.length === 0
      ? ["- Geen open taken"]
      : input.tasks.map(
          (t) =>
            `- ${t.title}${t.leadName ? ` (${t.leadName})` : ""} · due ${t.dueAt ?? "zonder datum"}`
        );

  return [
    `Ochtendbrief voor ${input.senderName} bij MATO.`,
    "Doel: vandaag stappen zetten naar productverkoop of automaathuur.",
    "",
    "Mijn open leads:",
    ...leadLines,
    "",
    "Open taken:",
    ...taskLines,
    "",
    "Schrijf focus (max 5) + markdown met: focus, pipeline-tabel, due/overdue, stale (>14d zonder contact), wat je vandaag níet doet.",
  ].join("\n");
}

export const CONTENT_SCHEMA = {
  type: "object",
  properties: {
    markdown: {
      type: "string",
      description: "Tien contentideeën in markdown, elk getagd koop/huur/beide",
    },
  },
  required: ["markdown"],
  additionalProperties: false,
} as const;

export function buildContentIdeasPrompt(): string {
  return [
    "Geef 10 contentideeën voor matoautomaat.be / sociale media.",
    "Elk idee promoot productverkoop en/of automaatverhuur aan voedingszaken in Vlaanderen.",
    "Geen AI-thought-leadership. Tag elk idee met (koop), (huur) of (beide).",
    "Per idee: korte hook + format (post/reel/mail) + CTA.",
  ].join("\n");
}
