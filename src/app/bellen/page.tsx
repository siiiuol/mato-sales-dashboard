import Link from "next/link";
import { CallMode } from "@/components/CallMode";
import {
  buildCallQueueWhere,
  CALL_QUEUE_ORDER,
  CALL_QUEUE_SELECT,
} from "@/lib/call-queue";
import { requirePageUser } from "@/lib/dal";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BellenPage() {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const leads = await prisma.lead.findMany({
    where: buildCallQueueWhere(user.id),
    orderBy: [...CALL_QUEUE_ORDER],
    take: 20,
    select: CALL_QUEUE_SELECT,
  });

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Verkoopuitvoering</p>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Belmodus</h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Eén beste lead tegelijk. Log het resultaat en ga direct door.
          </p>
        </div>
        <Link href="/" className="btn">
          Terug naar Vandaag
        </Link>
      </div>
      <CallMode
        initialLeads={leads.map((lead) => ({
          ...lead,
          outreach: lead.outreach.map((event) => ({
            ...event,
            createdAt: event.createdAt.toISOString(),
          })),
        }))}
      />
    </div>
  );
}
