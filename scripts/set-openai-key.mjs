import { PrismaClient } from "@prisma/client";

/**
 * Zet de OpenAI-sleutel in de database.
 *
 * Bedoeld voor het eerste gebruik; daarna is het veld gewoon bij Instellingen
 * aan te passen. De sleutel wordt hier niet afgedrukt.
 *
 * Draaien met: node scripts/set-openai-key.mjs "<sleutel>" [model]
 */

const prisma = new PrismaClient();
const key = process.argv[2];
const model = process.argv[3] || "gpt-4o-mini";

if (!key) {
  console.error('gebruik: node scripts/set-openai-key.mjs "<sleutel>" [model]');
  process.exit(1);
}

await prisma.appSettings.upsert({
  where: { id: "default" },
  update: { openAiApiKey: key, openAiModel: model },
  create: { id: "default", openAiApiKey: key, openAiModel: model },
});

console.log(`sleutel opgeslagen (${key.length} tekens), model: ${model}`);
await prisma.$disconnect();
