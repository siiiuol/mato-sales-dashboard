import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.lead.groupBy({ by: ["source"], _count: true });
  console.log("leads before", before);

  // Detach demo deals/quotes first where needed
  const demoLeads = await prisma.lead.findMany({
    where: {
      OR: [
        { source: { in: ["places_demo", "lead_bot_demo"] } },
        { placeId: { startsWith: "synth-" } },
        { placeId: { startsWith: "demo-" } },
        { intelligenceEstablishmentId: { startsWith: "demo-" } },
      ],
    },
    select: { id: true },
  });
  const ids = demoLeads.map((l) => l.id);

  if (ids.length) {
    await prisma.outreachEvent.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.deal.updateMany({
      where: { leadId: { in: ids } },
      data: { leadId: null },
    });
    const deleted = await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    console.log("deleted demo leads", deleted.count);
  } else {
    console.log("no demo leads matched");
  }

  // Also wipe any remaining synth placeIds / empty queues for cleanliness
  const leftover = await prisma.lead.deleteMany({
    where: {
      OR: [
        { placeId: { startsWith: "synth-" } },
        { placeId: { startsWith: "demo-" } },
      ],
    },
  });
  if (leftover.count) console.log("deleted leftover synth/demo placeIds", leftover.count);

  const demoDeals = await prisma.deal.deleteMany({
    where: { title: { contains: "Bakkerij De Korst" } },
  });
  if (demoDeals.count) console.log("deleted demo deals", demoDeals.count);

  const after = await prisma.lead.groupBy({ by: ["source"], _count: true });
  console.log("leads after", after);
  console.log("total leads", await prisma.lead.count());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
