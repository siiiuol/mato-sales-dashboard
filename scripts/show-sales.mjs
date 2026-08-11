import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const deals = await prisma.deal.findMany({
  where: { wonAt: { not: null } },
  orderBy: { wonAt: "desc" },
  select: {
    title: true,
    wonValue: true,
    wonAt: true,
    stage: true,
    owner: { select: { name: true, commissionType: true, commissionValue: true } },
    customer: { select: { name: true, leadId: true } },
    lead: { select: { name: true, status: true } },
  },
});

for (const deal of deals) {
  const commission =
    deal.owner?.commissionType === "FIXED"
      ? deal.owner.commissionValue
      : ((deal.wonValue ?? 0) * (deal.owner?.commissionValue ?? 0)) / 100;
  console.log(
    [
      deal.title,
      `€${deal.wonValue}`,
      `stage=${deal.stage}`,
      `owner=${deal.owner?.name}`,
      `commission=€${commission}`,
      `customer=${deal.customer?.name}`,
      `leadStatus=${deal.lead?.status}`,
      `customerLinkedToLead=${Boolean(deal.customer?.leadId)}`,
    ].join(" · ")
  );
}

await prisma.$disconnect();
