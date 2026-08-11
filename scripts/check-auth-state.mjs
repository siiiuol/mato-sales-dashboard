import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const user = await prisma.user.findFirst({
  select: { id: true, email: true, lastLoginAt: true, sessionVersion: true },
});
console.log("user:", JSON.stringify(user));

const attempts = await prisma.loginAttempt.findMany({
  select: { email: true, ip: true, success: true, createdAt: true },
  orderBy: { createdAt: "desc" },
  take: 10,
});
console.log("attempts:", JSON.stringify(attempts, null, 2));

await prisma.$disconnect();
