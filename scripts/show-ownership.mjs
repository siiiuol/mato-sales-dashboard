import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const owned = await prisma.lead.findMany({
  where: { ownerId: { not: null } },
  select: {
    name: true,
    status: true,
    ownedAt: true,
    owner: { select: { name: true, email: true } },
  },
  orderBy: { ownedAt: "desc" },
});

console.log(`leads op naam: ${owned.length}`);
for (const lead of owned) {
  console.log(`  ${lead.name} [${lead.status}] -> ${lead.owner?.name}`);
}

const free = await prisma.lead.count({ where: { ownerId: null } });
console.log(`vrij: ${free}`);

await prisma.$disconnect();
