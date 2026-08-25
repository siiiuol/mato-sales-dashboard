import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, active: true, role: true },
    orderBy: { name: "asc" },
  });
  for (const u of users) {
    console.log(`${u.active ? "ON " : "off"} ${u.role.padEnd(8)} ${u.name} <${u.email}> ${u.id}`);
  }
}

main().finally(() => prisma.$disconnect());
