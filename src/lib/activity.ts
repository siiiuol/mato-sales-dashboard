import {
  CALL_OUTCOMES,
  EMAIL_OUTCOMES,
  VISIT_OUTCOMES,
  contactTypeLabel,
} from "./constants";

/**
 * Alles wat er met een lead gebeurd is, op één tijdlijn.
 *
 * De bronnen liggen uit elkaar — contacten in `OutreachEvent`, mails in
 * `EmailDraft`, contracten in `GeneratedDocument`, de rest in `AuditEvent` — en
 * dat is prima om op te slaan, maar niet om te lezen. Hier komen ze samen in de
 * volgorde waarin het gebeurd is.
 */

export type ActivityKind =
  | "call"
  | "email"
  | "visit"
  | "note"
  | "mail"
  | "document"
  | "lead";

export type ActivityItem = {
  id: string;
  at: Date;
  kind: ActivityKind;
  title: string;
  detail: string | null;
  actor: string | null;
};

type Named = { name: string } | null | undefined;

export type ActivitySources = {
  outreach: Array<{
    id: string;
    createdAt: Date;
    type: string;
    outcome: string | null;
    note: string | null;
    createdBy?: Named;
  }>;
  drafts: Array<{
    id: string;
    createdAt: Date;
    subject: string;
    status: string;
    createdBy?: Named;
  }>;
  documents: Array<{
    id: string;
    createdAt: Date;
    number: string;
    title: string;
    status: string;
    signerName: string | null;
    createdBy?: Named;
  }>;
  audits: Array<{
    id: string;
    createdAt: Date;
    action: string;
    detail: string | null;
    actor?: Named;
  }>;
};

/**
 * Handelingen die al door een rijkere bron verteld worden.
 *
 * Het logboek registreert élke handeling, ook die waarvan het gesprek of het
 * document zelf al bestaat. Zonder deze lijst staat elk telefoongesprek twee
 * keer op de tijdlijn: één keer met resultaat en notitie, één keer als kale
 * regel "call.logged".
 */
const COVERED_BY_RICHER_SOURCE = new Set([
  "call.logged",
  "contact.logged",
  "document.generated",
  "mail.drafted",
  "mail.approved",
]);

/** Logboekhandelingen in gewone taal. */
const AUDIT_LABELS: Record<string, string> = {
  "lead.taken": "Op naam gezet",
  "lead.released": "Teruggegeven aan de gedeelde lijst",
  "lead.reassigned": "Toegewezen aan iemand anders",
  "lead.won": "Verkocht",
  "lead.created": "Handmatig toegevoegd",
  "lead.contact_approved": "Interessant bevonden",
  "lead.skipped": "Overgeslagen",
  "lead.unskipped": "Teruggezet naar de selectie",
  "lead.compliance_changed": "Toestemming aangepast",
  "document.signed": "Document getekend",
  "mail.discarded": "Mailconcept verwijderd",
};

const OUTCOME_LABELS = new Map<string, string>([
  ...CALL_OUTCOMES.map((o) => [o.value as string, o.label] as const),
  ...EMAIL_OUTCOMES.map((o) => [o.value as string, o.label] as const),
  ...VISIT_OUTCOMES.map((o) => [o.value as string, o.label] as const),
]);

const DRAFT_STATUS_LABELS: Record<string, string> = {
  PREPARED: "opgesteld",
  APPROVED: "nagelezen",
  SENT: "verstuurd",
};

const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "concept",
  READY: "klaar",
  SENT: "verstuurd",
  SIGNED: "getekend",
};

function outreachKind(type: string): ActivityKind {
  if (type === "EMAIL") return "email";
  if (type === "VISIT") return "visit";
  if (type === "NOTE") return "note";
  return "call";
}

function outreachTitle(type: string, outcome: string | null): string {
  const typeLabel = contactTypeLabel(type);
  if (type === "NOTE") return typeLabel;
  if (!outcome) return typeLabel;
  const outcomeLabel = OUTCOME_LABELS.get(outcome) ?? outcome;
  return `${typeLabel} — ${outcomeLabel}`;
}

export function buildActivity(sources: ActivitySources): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const event of sources.outreach) {
    items.push({
      id: `outreach-${event.id}`,
      at: event.createdAt,
      kind: outreachKind(event.type),
      title: outreachTitle(event.type, event.outcome),
      detail: event.note,
      actor: event.createdBy?.name ?? null,
    });
  }

  for (const draft of sources.drafts) {
    items.push({
      id: `mail-${draft.id}`,
      at: draft.createdAt,
      kind: "mail",
      title: `Mail ${DRAFT_STATUS_LABELS[draft.status] ?? draft.status.toLowerCase()}`,
      detail: draft.subject,
      actor: draft.createdBy?.name ?? null,
    });
  }

  for (const document of sources.documents) {
    const status =
      DOCUMENT_STATUS_LABELS[document.status] ?? document.status.toLowerCase();
    items.push({
      id: `doc-${document.id}`,
      at: document.createdAt,
      kind: "document",
      title: `Contract ${status}`,
      detail: [document.number, document.signerName ? `getekend door ${document.signerName}` : null]
        .filter(Boolean)
        .join(" · "),
      actor: document.createdBy?.name ?? null,
    });
  }

  for (const audit of sources.audits) {
    if (COVERED_BY_RICHER_SOURCE.has(audit.action)) continue;
    items.push({
      id: `audit-${audit.id}`,
      at: audit.createdAt,
      kind: "lead",
      title: AUDIT_LABELS[audit.action] ?? audit.action,
      detail: readableDetail(audit.detail),
      actor: audit.actor?.name ?? null,
    });
  }

  return items.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/**
 * Maakt de opgeslagen JSON leesbaar, of laat hem weg.
 *
 * In het logboek staat `{"previousStatus":"NEW"}`; dat is nuttig om te bewaren
 * en onleesbaar om te tonen.
 */
export function readableDetail(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return String(parsed);
    const parts = Object.entries(parsed as Record<string, unknown>)
      .filter(([key, value]) => {
        if (value === null || value === undefined || value === "") return false;
        return !isIdentifier(key, value);
      })
      .map(([key, value]) => `${DETAIL_LABELS[key] ?? key}: ${value}`);
    return parts.length ? parts.join(" · ") : null;
  } catch {
    return raw;
  }
}

function isIdentifier(key: string, value: unknown): boolean {
  if (/Id$/.test(key) || key === "to" || key === "previousOwner") return true;
  return typeof value === "string" && /^c[a-z0-9]{20,}$/.test(value);
}

const DETAIL_LABELS: Record<string, string> = {
  outcome: "resultaat",
  type: "soort",
  previousStatus: "was",
  value: "bedrag",
  product: "product",
  number: "nummer",
  signer: "getekend door",
  to: "naar",
  complianceStatus: "toestemming",
};

/** Telt per soort, voor een kopregel boven de tijdlijn. */
export function activityCounts(items: ActivityItem[]): Record<ActivityKind, number> {
  const counts: Record<ActivityKind, number> = {
    call: 0,
    email: 0,
    visit: 0,
    note: 0,
    mail: 0,
    document: 0,
    lead: 0,
  };
  for (const item of items) counts[item.kind]++;
  return counts;
}

/** Kort overzicht voor de kop van de fiche. */
export function contactCount(items: ActivityItem[]): number {
  return items.filter((i) =>
    i.kind === "call" || i.kind === "email" || i.kind === "visit" || i.kind === "note"
  ).length;
}
