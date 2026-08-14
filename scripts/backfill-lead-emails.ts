import { PrismaClient } from "@prisma/client";
import { cleanEmail } from "../src/lib/osm";

/**
 * Vult mailadressen aan bij leads die al in de database staan.
 *
 * De zoekfunctie las het `email`-veld van OpenStreetMap vroeger niet uit, dus
 * elke lead van vóór die verandering heeft er geen — en zonder mailadres kan er
 * geen mail vertrekken en is een antwoord nooit op afzender terug te vinden.
 *
 * Alleen leads met een OSM-herkomst: hun `placeId` bevat het type en het nummer
 * waarmee het element rechtstreeks op te vragen is. Zaken die via Google Places
 * gevonden zijn hebben geen mailadres in de bron.
 *
 * Draait alleen aanvullend: een adres dat er al staat wordt nooit overschreven.
 */

const OVERPASS = "https://overpass-api.de/api/interpreter";
const BATCH = 150;
const DRY_RUN = !process.argv.includes("--write");

const prisma = new PrismaClient();

type Element = { type: string; id: number; tags?: Record<string, string> };

async function fetchElements(ids: { type: string; id: string }[]): Promise<Element[]> {
  const byType = new Map<string, string[]>();
  for (const { type, id } of ids) {
    byType.set(type, [...(byType.get(type) ?? []), id]);
  }

  const parts = [...byType.entries()].map(
    ([type, list]) => `${type}(id:${list.join(",")});`
  );
  const ql = `[out:json][timeout:90];\n(\n${parts.join("\n")}\n);\nout tags;`;

  // Overpass is gratis en deelt zijn capaciteit; 429 betekent gewoon wachten.
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await fetch(OVERPASS, {
      method: "POST",
      body: `data=${encodeURIComponent(ql)}`,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "MATO-Dashboard/1.0 (local lead discovery)",
      },
    });

    if (response.ok) {
      const data = (await response.json()) as { elements: Element[] };
      return data.elements ?? [];
    }

    if (response.status !== 429 && response.status !== 504) {
      throw new Error(`Overpass gaf ${response.status}`);
    }

    const wait = attempt * 20_000;
    console.log(`  (${response.status} — ${wait / 1000}s wachten, poging ${attempt})`);
    await new Promise((r) => setTimeout(r, wait));
  }

  throw new Error("Overpass blijft weigeren; probeer het later opnieuw.");
}

async function main() {
  const leads = await prisma.lead.findMany({
    where: { email: null, placeId: { startsWith: "osm:" } },
    select: { id: true, name: true, placeId: true },
  });

  console.log(`leads zonder mailadres, uit OpenStreetMap: ${leads.length}`);
  if (!leads.length) return;

  // placeId ziet eruit als "osm:node/123456".
  const parsed = leads.flatMap((lead) => {
    const match = /^osm:(node|way|relation)\/(\d+)$/.exec(lead.placeId ?? "");
    if (!match) return [];
    return [{ leadId: lead.id, name: lead.name, type: match[1], id: match[2] }];
  });

  console.log(`bruikbare OSM-verwijzingen               : ${parsed.length}`);

  let found = 0;
  let written = 0;

  for (let i = 0; i < parsed.length; i += BATCH) {
    const slice = parsed.slice(i, i + BATCH);
    const elements = await fetchElements(slice);
    const tagsByKey = new Map(
      elements.map((el) => [`${el.type}/${el.id}`, el.tags ?? {}])
    );

    for (const entry of slice) {
      const tags = tagsByKey.get(`${entry.type}/${entry.id}`);
      if (!tags) continue;
      const email = cleanEmail(tags.email || tags["contact:email"]);
      if (!email) continue;

      found++;
      console.log(`  ${entry.name} -> ${email}`);
      if (!DRY_RUN) {
        // Alleen waar het nog leeg is; een handmatig ingevuld adres wint.
        const updated = await prisma.lead.updateMany({
          where: { id: entry.leadId, email: null },
          data: { email },
        });
        written += updated.count;
      }
    }

    console.log(`  … ${Math.min(i + BATCH, parsed.length)}/${parsed.length} nagekeken`);
    // Overpass is een gratis dienst; niet erop rammen.
    if (i + BATCH < parsed.length) await new Promise((r) => setTimeout(r, 15_000));
  }

  console.log("");
  console.log(`mailadressen gevonden : ${found}`);
  console.log(
    DRY_RUN
      ? "PROEFDRAAI — er is niets weggeschreven. Draai opnieuw met --write."
      : `weggeschreven         : ${written}`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
