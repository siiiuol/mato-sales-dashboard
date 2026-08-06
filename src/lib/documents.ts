/**
 * Document Studio core (spec §38, §40, §42, §43).
 *
 * Pure helpers only — no database access — so the rules are unit testable and
 * identical wherever they run.
 */

export type TemplateStatus =
  | "DRAFT"
  | "UNDER_REVIEW"
  | "MATO_APPROVED"
  | "ACCOUNTANT_APPROVED"
  | "LEGAL_APPROVED"
  | "SUPERSEDED"
  | "EXPIRED"
  | "BLOCKED";

/** Statuses a template may actually be used to generate from (§40.1). */
export const USABLE_TEMPLATE_STATUSES: TemplateStatus[] = [
  "MATO_APPROVED",
  "ACCOUNTANT_APPROVED",
  "LEGAL_APPROVED",
];

export type TemplateUsability = { usable: boolean; reason?: string };

/**
 * §40.1: expired or blocked templates cannot be used. A review date in the
 * past also blocks — an unreviewed template is not an approved one.
 */
export function checkTemplateUsable(
  template: { status: string; effectiveAt?: Date | null; reviewAt?: Date | null },
  now: Date = new Date()
): TemplateUsability {
  if (template.status === "BLOCKED") return { usable: false, reason: "Template is blocked" };
  if (template.status === "EXPIRED") return { usable: false, reason: "Template has expired" };
  if (template.status === "SUPERSEDED") {
    return { usable: false, reason: "Template superseded by a newer version" };
  }
  if (!USABLE_TEMPLATE_STATUSES.includes(template.status as TemplateStatus)) {
    return { usable: false, reason: "Template is not approved for use" };
  }
  if (template.effectiveAt && template.effectiveAt > now) {
    return { usable: false, reason: "Template is not effective yet" };
  }
  if (template.reviewAt && template.reviewAt < now) {
    return { usable: false, reason: "Template is overdue for compliance review" };
  }
  return { usable: true };
}

/**
 * Formats a document number (§43): MATO-<PREFIX>-<YEAR>-<0001>.
 * Counters are owned by the database; this only renders them.
 */
export function formatDocumentNumber(prefix: string, year: number, counter: number) {
  const clean = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `MATO-${clean}-${year}-${String(counter).padStart(4, "0")}`;
}

export function sequenceId(prefix: string, year: number) {
  return `${prefix.toUpperCase().replace(/[^A-Z0-9]/g, "")}-${year}`;
}

/** Tokens look like {{customer.name}}. Unknown tokens are reported, never guessed. */
const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function extractTokens(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(TOKEN)) found.add(match[1]);
  return [...found];
}

function lookup(context: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, context);
}

export type RenderResult = { body: string; missing: string[] };

/**
 * Fills template tokens from context. Missing values are left as a visible
 * placeholder and reported — never silently blanked, because a contract with a
 * quietly empty payment term is worse than one that obviously needs attention.
 */
export function renderTemplate(
  body: string,
  context: Record<string, unknown>
): RenderResult {
  const missing: string[] = [];
  const rendered = body.replace(TOKEN, (_full, path: string) => {
    const value = lookup(context, path);
    if (value === undefined || value === null || value === "") {
      if (!missing.includes(path)) missing.push(path);
      return `«${path}»`;
    }
    return String(value);
  });
  return { body: rendered, missing };
}

export type ValidationIssue = {
  field: string;
  message: string;
  severity: "BLOCKER" | "WARNING";
};

export type ValidationInput = {
  template: { status: string; effectiveAt?: Date | null; reviewAt?: Date | null };
  requiredFields: string[];
  context: Record<string, unknown>;
  missingTokens: string[];
  clauses: { code: string; status: string; mandatory: boolean; text: string }[];
  mandatoryClauseCodes?: string[];
};

/**
 * §42: everything that must be true before a document may be approved.
 * BLOCKER issues prevent approval; warnings are surfaced but allow it.
 */
export function validateDocument(input: ValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const usable = checkTemplateUsable(input.template);
  if (!usable.usable) {
    issues.push({
      field: "template",
      message: usable.reason ?? "Template unusable",
      severity: "BLOCKER",
    });
  }

  for (const field of input.requiredFields) {
    const value = lookup(input.context, field);
    if (value === undefined || value === null || value === "") {
      issues.push({
        field,
        message: `Required field “${field}” is empty`,
        severity: "BLOCKER",
      });
    }
  }

  for (const token of input.missingTokens) {
    if (input.requiredFields.includes(token)) continue;
    issues.push({
      field: token,
      message: `Template placeholder “${token}” has no value`,
      severity: "WARNING",
    });
  }

  for (const clause of input.clauses) {
    if (clause.status === "EXPIRED" || clause.status === "BLOCKED") {
      issues.push({
        field: `clause:${clause.code}`,
        message: `Clause ${clause.code} is ${clause.status.toLowerCase()} and cannot be used`,
        severity: "BLOCKER",
      });
    }
    if (clause.status === "DRAFT") {
      issues.push({
        field: `clause:${clause.code}`,
        message: `Clause ${clause.code} is still a draft and has not been reviewed`,
        severity: "BLOCKER",
      });
    }
    if (!clause.text.trim()) {
      issues.push({
        field: `clause:${clause.code}`,
        message: `Clause ${clause.code} has no text in this language`,
        severity: "BLOCKER",
      });
    }
  }

  for (const code of input.mandatoryClauseCodes ?? []) {
    if (!input.clauses.some((c) => c.code === code)) {
      issues.push({
        field: `clause:${code}`,
        message: `Mandatory clause ${code} is missing`,
        severity: "BLOCKER",
      });
    }
  }

  return issues;
}

export function hasBlockers(issues: ValidationIssue[]) {
  return issues.some((i) => i.severity === "BLOCKER");
}

/**
 * §41: non-standard or high-risk documents must go to a human specialist.
 * The system never claims a generated document is legally guaranteed.
 */
export function needsExternalReview(input: {
  clauses: { riskLevel: string; edited?: boolean }[];
  templateStatus: string;
  discountPercent?: number;
  totalValueEur?: number;
}): { required: boolean; reason?: string } {
  if (input.clauses.some((c) => c.edited)) {
    return { required: true, reason: "A legal clause was manually edited" };
  }
  if (input.clauses.some((c) => c.riskLevel === "HIGH")) {
    return { required: true, reason: "Document contains a high-risk clause" };
  }
  if (input.templateStatus === "MATO_APPROVED") {
    return {
      required: true,
      reason: "Template has internal approval only — no accountant or legal sign-off",
    };
  }
  if ((input.discountPercent ?? 0) > 20) {
    return { required: true, reason: "Discount above 20% requires management review" };
  }
  if ((input.totalValueEur ?? 0) > 50_000) {
    return { required: true, reason: "Contract value above €50.000 requires review" };
  }
  return { required: false };
}
