import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const claimed = await prisma.lead.findMany({
  where: { claimedById: { not: null } },
  select: {
    id: true,
    name: true,
    status: true,
    claimedAt: true,
    claimedBy: { select: { name: true, email: true } },
  },
  orderBy: { claimedAt: "desc" },
});

if (!claimed.length) {
  console.log("no leads are claimed");
} else {
  for (const lead of claimed) {
    console.log(
      `${lead.name} [${lead.status}] -> ${lead.claimedBy?.name} (${lead.claimedBy?.email}) at ${lead.claimedAt?.toISOString()}`
    );
  }
}

await prisma.$disconnect();
