import {
  potentialDuplicatePairs,
  type BusinessIdentity,
} from "./dedupe";
import { isLeadStale, OPEN_LEAD_STATUSES } from "./today-dashboard";

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
