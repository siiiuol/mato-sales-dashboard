import type { PrismaClient } from "@prisma/client";
import {
  potentialDuplicatePairs,
  type BusinessIdentity,
} from "./dedupe";
import {
  isLeadStale,
  OPEN_LEAD_STATUSES,
  staleCutoff,
} from "./today-dashboard";

export type QualityLead = BusinessIdentity & {
  id: string;
  status: string;
  ownerId: string | null;
  nextActionAt: Date | null;
  lastTouchedAt: Date | null;
  createdAt: Date;
  complianceStatus: string;
  email?: string | null;
};

export type LeadQualitySummary = Awaited<
  ReturnType<typeof fetchLeadQualityCounts>
>;

const OPEN_STATUS_FILTER = { in: [...OPEN_LEAD_STATUSES] };

const DEDUPE_SAMPLE = {
  id: true,
  name: true,
  city: true,
  phone: true,
  website: true,
  lat: true,
  lng: true,
  status: true,
} as const;

export function summarizeLeadQuality(leads: QualityLead[], now = new Date()) {
  const open = leads.filter((lead) =>
    (OPEN_LEAD_STATUSES as readonly string[]).includes(lead.status)
  );
  return {
    missingContact: open.filter(
      (lead) => !lead.phone?.trim() && !lead.email?.trim()
    ).length,
    ownerless: open.filter((lead) => !lead.ownerId).length,
    withoutNextAction: open.filter((lead) => !lead.nextActionAt).length,
    stale: open.filter((lead) => isLeadStale(lead, now)).length,
    pendingTriage: leads.filter(
      (lead) =>
        lead.status === "NEW" && lead.complianceStatus === "PENDING"
    ).length,
    duplicatePairs: potentialDuplicatePairs(open).slice(0, 25),
  };
}

/** Fast counts for dashboard cards — skips duplicate-pair sampling. */
export async function fetchLeadQualityCounts(
  db: PrismaClient,
  now = new Date()
) {
  const staleBefore = staleCutoff(now);

  const [missingContact, ownerless, withoutNextAction, stale, pendingTriage] =
    await Promise.all([
      db.lead.count({
        where: {
          status: OPEN_STATUS_FILTER,
          AND: [
            { OR: [{ phone: null }, { phone: "" }] },
            { OR: [{ email: null }, { email: "" }] },
          ],
        },
      }),
      db.lead.count({
        where: { status: OPEN_STATUS_FILTER, ownerId: null },
      }),
      db.lead.count({
        where: { status: OPEN_STATUS_FILTER, nextActionAt: null },
      }),
      db.lead.count({
        where: {
          status: OPEN_STATUS_FILTER,
          OR: [
            { lastTouchedAt: { lt: staleBefore } },
            { lastTouchedAt: null, createdAt: { lt: staleBefore } },
          ],
        },
      }),
      db.lead.count({
        where: { status: "NEW", complianceStatus: "PENDING" },
      }),
    ]);

  return {
    missingContact,
    ownerless,
    withoutNextAction,
    stale,
    pendingTriage,
    duplicatePairs: [] as ReturnType<typeof summarizeLeadQuality>["duplicatePairs"],
  };
}

/** Counts in SQL instead of loading hundreds of leads on the home page. */
export async function fetchLeadQualitySummary(
  db: PrismaClient,
  now = new Date()
) {
  const staleBefore = staleCutoff(now);

  const [
    missingContact,
    ownerless,
    withoutNextAction,
    stale,
    pendingTriage,
    dedupeSample,
  ] = await Promise.all([
    db.lead.count({
      where: {
        status: OPEN_STATUS_FILTER,
        AND: [
          { OR: [{ phone: null }, { phone: "" }] },
          { OR: [{ email: null }, { email: "" }] },
        ],
      },
    }),
    db.lead.count({
      where: { status: OPEN_STATUS_FILTER, ownerId: null },
    }),
    db.lead.count({
      where: { status: OPEN_STATUS_FILTER, nextActionAt: null },
    }),
    db.lead.count({
      where: {
        status: OPEN_STATUS_FILTER,
        OR: [
          { lastTouchedAt: { lt: staleBefore } },
          { lastTouchedAt: null, createdAt: { lt: staleBefore } },
        ],
      },
    }),
    db.lead.count({
      where: { status: "NEW", complianceStatus: "PENDING" },
    }),
    db.lead.findMany({
      where: { status: OPEN_STATUS_FILTER },
      orderBy: { updatedAt: "desc" },
      take: 150,
      select: DEDUPE_SAMPLE,
    }),
  ]);

  return {
    missingContact,
    ownerless,
    withoutNextAction,
    stale,
    pendingTriage,
    duplicatePairs: potentialDuplicatePairs(dedupeSample).slice(0, 25),
  };
}
