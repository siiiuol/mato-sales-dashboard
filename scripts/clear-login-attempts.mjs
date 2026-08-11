import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const { count } = await prisma.loginAttempt.deleteMany({});
console.log(`cleared ${count} login attempts`);
await prisma.$disconnect();
