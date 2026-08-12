import { PrismaClient } from "@prisma/client";
import { buildMailPrompt, SYSTEM_PROMPT } from "../src/lib/mail-prompt";
import { draftMail } from "../src/lib/anthropic";

/**
 * Stelt één mail op tegen de echte API, om te zien wat er werkelijk uit komt.
 *
 * Draaien met: npx tsx scripts/smoke-mail-draft.ts [zoekterm]
 */

const prisma = new PrismaClient();
const NEEDLE = process.argv[2] || "Delecta";

async function main() {
  const [lead, settings] = await Promise.all([
    prisma.lead.findFirst({
      where: { name: { contains: NEEDLE } },
      select: {
        name: true,
        city: true,
        province: true,
        category: true,
        website: true,
        hasVending: true,
        vendingDetail: true,
        nearbyVending: true,
        sellsTakeaway: true,
      },
    }),
    prisma.appSettings.findUnique({ where: { id: "default" } }),
  ]);

  if (!lead) throw new Error(`geen lead gevonden voor "${NEEDLE}"`);

  const prompt = buildMailPrompt({
    lead,
    senderName: "Jonas Vermeulen",
    businessName: settings?.businessName || "MATO",
  });

  console.log("--- opdracht ---");
  console.log(prompt);

  const started = Date.now();
  const draft = await draftMail({
    apiKey: settings?.anthropicApiKey ?? "",
    model: settings?.anthropicModel || "claude-sonnet-4-20250514",
    system: SYSTEM_PROMPT,
    prompt,
  });

  console.log(`\n--- antwoord (${Date.now() - started} ms) ---`);
  console.log(`Onderwerp: ${draft.subject}`);
  console.log();
  console.log(draft.body);
  console.log(`\nwoorden: ${draft.body.split(/\s+/).length}`);
}

main()
  .catch((err) => {
    console.error("MISLUKT:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
