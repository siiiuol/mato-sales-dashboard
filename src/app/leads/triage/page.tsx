import Link from "next/link";
import { TriageInbox } from "@/components/TriageInbox";
import { requirePageUser } from "@/lib/dal";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TriagePage() {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const leads = await prisma.lead.findMany({
    where: { status: "NEW", complianceStatus: "PENDING" },
    orderBy: [
      { hasVending: "desc" },
      { score: "desc" },
      { nearbyVending: "desc" },
      { createdAt: "asc" },
    ],
    take: 100,
    select: {
      id: true,
      name: true,
      city: true,
      category: true,
      phone: true,
      website: true,
      score: true,
      reason: true,
      hasVending: true,
      nearbyVending: true,
    },
  });

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Compliance & selectie</p>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1">
            Triage-inbox
          </h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Beoordeel gescande leads vóór ze in de belwachtrij komen.
          </p>
        </div>
        <Link href="/leads" className="btn">
          Alle leads
        </Link>
      </div>
      <TriageInbox initialLeads={leads} />
    </div>
  );
}
