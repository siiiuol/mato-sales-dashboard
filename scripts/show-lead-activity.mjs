import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const events = await prisma.outreachEvent.findMany({
  orderBy: { createdAt: "desc" },
  take: 5,
  select: {
    outcome: true,
    note: true,
    createdAt: true,
    createdBy: { select: { name: true, email: true } },
    lead: {
      select: {
        name: true,
        status: true,
        claimedById: true,
        owner: { select: { name: true } },
      },
    },
  },
});

for (const event of events) {
  console.log(
    [
      event.lead.name,
      `outcome=${event.outcome}`,
      `status=${event.lead.status}`,
      `claimed=${event.lead.claimedById ?? "none"}`,
      `owner=${event.lead.owner?.name ?? "none"}`,
      `by=${event.createdBy?.name ?? "unknown"}`,
    ].join(" · ")
  );
}

await prisma.$disconnect();
