import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.documentTemplate.updateMany({
    where: { code: { startsWith: "PARTNER_" }, status: "DRAFT" },
    data: { status: "MATO_APPROVED", effectiveAt: new Date() },
  });
  console.log("activated", result.count);
}

main()
  .finally(() => prisma.$disconnect());
