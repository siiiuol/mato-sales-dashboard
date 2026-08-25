import { PrismaClient } from "@prisma/client";
import { storeSettingSecret } from "../src/lib/settings-secrets";

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: {
      placesApiKey: true,
      anthropicApiKey: true,
      msClientSecret: true,
    },
  });

  if (!settings) {
    console.log("Geen app-instellingen gevonden.");
    return;
  }

  const next = {
    placesApiKey: storeSettingSecret(settings.placesApiKey) ?? "",
    anthropicApiKey: storeSettingSecret(settings.anthropicApiKey) ?? "",
    msClientSecret: storeSettingSecret(settings.msClientSecret) ?? "",
  };

  if (
    next.placesApiKey === settings.placesApiKey &&
    next.anthropicApiKey === settings.anthropicApiKey &&
    next.msClientSecret === settings.msClientSecret
  ) {
    console.log("Alle ingestelde geheimen zijn al versleuteld.");
    return;
  }

  await prisma.appSettings.update({
    where: { id: "default" },
    data: next,
  });
  console.log("Places-, Anthropic- en Microsoft-geheimen zijn versleuteld.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
