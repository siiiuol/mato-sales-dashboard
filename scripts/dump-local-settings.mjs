import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const row = await prisma.appSettings.findUnique({ where: { id: "default" } });
if (!row) {
  console.log("NO_SETTINGS");
} else {
  console.log(
    JSON.stringify(
      {
        placesApiKey: row.placesApiKey || "",
        anthropicApiKey: row.anthropicApiKey || "",
        openAiApiKey: row.openAiApiKey || "",
        anthropicModel: row.anthropicModel,
        openAiModel: row.openAiModel,
        msClientId: row.msClientId || "",
        msTenantId: row.msTenantId || "",
      },
      null,
      2
    )
  );
}
await prisma.$disconnect();
