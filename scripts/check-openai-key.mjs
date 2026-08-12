import { PrismaClient } from "@prisma/client";

/**
 * Vraagt OpenAI wat er precies mis is met de sleutel.
 *
 * De app vertaalt foutcodes naar leesbare zinnen; hier is de onbewerkte
 * boodschap juist wél nuttig. De sleutel zelf wordt niet afgedrukt.
 */

const prisma = new PrismaClient();
const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
const key = settings?.openAiApiKey ?? "";

console.log(`sleutel aanwezig: ${key ? `ja (${key.length} tekens)` : "nee"}`);
console.log(`model: ${settings?.openAiModel}`);

if (key) {
  const models = await fetch("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${key}` },
  });
  console.log(`\nGET /v1/models -> ${models.status}`);
  const body = await models.json().catch(() => ({}));
  if (models.ok) {
    const ids = (body.data ?? []).map((m) => m.id).sort();
    console.log(`modellen beschikbaar: ${ids.length}`);
    console.log(ids.filter((id) => /^(gpt|o[0-9])/.test(id)).slice(0, 25).join("\n"));
  } else {
    console.log(JSON.stringify(body, null, 2));
  }

  const chat = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: settings?.openAiModel || "gpt-4o-mini",
      messages: [{ role: "user", content: "zeg enkel: ok" }],
      max_tokens: 5,
    }),
  });
  console.log(`\nPOST /v1/chat/completions -> ${chat.status}`);
  console.log(JSON.stringify(await chat.json().catch(() => ({})), null, 2).slice(0, 800));
}

await prisma.$disconnect();
