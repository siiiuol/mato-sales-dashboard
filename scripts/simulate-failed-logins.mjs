import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const email = process.argv[2] || "admin@mato.local";
const count = Number(process.argv[3] || 4);

for (let i = 0; i < count; i++) {
  await prisma.loginAttempt.create({
    data: { email, ip: "::1", success: false },
  });
}

const failures = await prisma.loginAttempt.count({
  where: {
    email,
    success: false,
    createdAt: { gte: new Date(Date.now() - 15 * 60_000) },
  },
});
console.log(`recent failures for ${email}: ${failures}`);

await prisma.$disconnect();
