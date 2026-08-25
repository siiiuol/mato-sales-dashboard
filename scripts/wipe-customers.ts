/**
 * Wis alle klanten — fresh start (leads blijven).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.customer.count();

  // Eerst FKs zonder cascade loskoppelen.
  await prisma.deal.updateMany({ data: { customerId: null } });
  await prisma.generatedDocument.updateMany({ data: { customerId: null } });
  await prisma.meeting.updateMany({ data: { customerId: null } });
  await prisma.task.updateMany({ data: { customerId: null } });

  // Cascade: placements, purchases, contacts, …
  await prisma.customer.deleteMany({});

  const after = await prisma.customer.count();
  const placements = await prisma.machinePlacement.count();
  console.log(`Customers: ${before} → ${after}. Placements left: ${placements}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
