import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const [total, withVending, withNearby, withTakeaway, withBoth] = await Promise.all([
  prisma.lead.count(),
  prisma.lead.count({ where: { hasVending: true } }),
  prisma.lead.count({ where: { nearbyVending: { gt: 0 } } }),
  prisma.lead.count({ where: { sellsTakeaway: true } }),
  prisma.lead.count({ where: { hasVending: false, nearbyVending: { gt: 0 } } }),
]);

console.log(`leads:                        ${total}`);
console.log(`has its own machine:          ${withVending}`);
console.log(`a machine within 1.5 km:      ${withNearby}`);
console.log(`FOMO only (no machine yet):   ${withBoth}`);
console.log(`sells takeaway:               ${withTakeaway}`);

const sample = await prisma.lead.findMany({
  where: { hasVending: false, nearbyVending: { gt: 0 } },
  orderBy: [{ score: "desc" }, { nearbyVending: "desc" }],
  take: 5,
  select: { name: true, city: true, score: true, nearbyVending: true, reason: true },
});

console.log("\ntop FOMO prospects (no machine of their own):");
for (const lead of sample) {
  console.log(`  ${lead.score}  ${lead.name} (${lead.city}) — ${lead.reason}`);
}

await prisma.$disconnect();
