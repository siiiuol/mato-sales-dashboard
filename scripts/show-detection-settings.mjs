import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
console.log("stored detectionCategories:", settings?.detectionCategories);
console.log("has Places key:", Boolean(settings?.placesApiKey?.trim()));
await prisma.$disconnect();
