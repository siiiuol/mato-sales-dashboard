import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const email = process.argv[2] || "admin@mato.local";

const user = await prisma.user.update({
  where: { email },
  data: { sessionVersion: { increment: 1 } },
  select: { email: true, sessionVersion: true },
});
console.log("bumped:", JSON.stringify(user));

await prisma.$disconnect();
