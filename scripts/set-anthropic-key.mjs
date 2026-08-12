import { PrismaClient } from "@prisma/client";

/**
 * Zet de Anthropic-sleutel en het model in de database.
 *
 * Bedoeld voor het eerste gebruik; daarna is het gewoon bij Instellingen aan te
 * passen. De sleutel wordt niet afgedrukt.
 *
 * Draaien met: node scripts/set-anthropic-key.mjs "<sleutel>" [model]
 */

const prisma = new PrismaClient();
const key = process.argv[2];
const model = process.argv[3] || "claude-sonnet-5";

if (!key) {
  console.error('gebruik: node scripts/set-anthropic-key.mjs "<sleutel>" [model]');
  process.exit(1);
}

await prisma.appSettings.upsert({
  where: { id: "default" },
  update: { anthropicApiKey: key, anthropicModel: model },
  create: { id: "default", anthropicApiKey: key, anthropicModel: model },
});

console.log(`sleutel opgeslagen (${key.length} tekens), model: ${model}`);
await prisma.$disconnect();
