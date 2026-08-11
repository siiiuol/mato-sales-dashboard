import { PrismaClient } from "@prisma/client";
import { scoreLead, CATEGORY_WEIGHT, SCORE_WEIGHTS } from "../src/lib/detection";

/**
 * Herstelt het "grotere zaak"-signaal dat de eerste backfill kwijtspeelde.
 *
 * `reviewCount` werd bij het scannen gebruikt en daarna weggegooid, dus toen de
 * scores herberekend werden verdween dat deel van de score. 157 leads zakten
 * daardoor, sommige met veertien punten.
 *
 * De oude score staat nog in de reservekopie van vóór de backfill, en die score
 * is een optelsom waarvan alle andere termen bekend zijn. Wat overblijft ís de
 * bonus voor grootte:
 *
 *     oud = categorie + telefoon + automaat + grootte + basis
 *     grootte = oud − categorie − telefoon − automaat − basis
 *
 * Dat wordt teruggezet als `reviewCount`, waar het voortaan blijft staan.
 * Bij een score van 99 was er afgekapt en is de uitkomst een ondergrens — die
 * leads staan sowieso bovenaan, dus dat verandert hun plaats niet.
 *
 * Draaien met: npx tsx scripts/repair-size-signal.ts [--apply]
 */

const BACKUP_URL =
  "file:C:/Users/louis/AppData/Local/Temp/claude/C--Users-louis-Documents-GitHub-MATO/74f3b4a3-132f-4626-bcd5-80d4dfae3745/scratchpad/dev.db.before-stage-b";

const prisma = new PrismaClient();
const backup = new PrismaClient({ datasources: { db: { url: BACKUP_URL } } });
const apply = process.argv.includes("--apply");

async function main() {
  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      phone: true,
      score: true,
      hasVending: true,
      nearbyVending: true,
      sellsTakeaway: true,
      province: true,
    },
  });

  const old = await backup.lead.findMany({
    select: { id: true, score: true },
  });
  const oldScore = new Map(old.map((l) => [l.id, l.score]));

  let repaired = 0;
  let stillLower = 0;
  const examples: string[] = [];

  for (const lead of leads) {
    const previous = oldScore.get(lead.id);
    if (previous === undefined) continue;

    const category = lead.category ?? "bakery";
    const base = CATEGORY_WEIGHT[category] ?? 15;
    const phone = lead.phone ? SCORE_WEIGHTS.phone : 0;
    const vending = lead.hasVending ? SCORE_WEIGHTS.hasVending : 0;

    const derivedSize = Math.max(
      0,
      Math.min(
        SCORE_WEIGHTS.sizeMax,
        previous - base - phone - vending - SCORE_WEIGHTS.base
      )
    );
    // reviewCount rondt terug via floor(n / 5), dus dit is exact omkeerbaar.
    const reviewCount = derivedSize * 5;

    const { score, reason } = scoreLead({
      category,
      phone: lead.phone,
      reviewCount,
      hasVending: lead.hasVending,
      nearbyVending: lead.nearbyVending,
      sellsTakeaway: lead.sellsTakeaway,
    });

    if (score < previous) {
      stillLower++;
      if (examples.length < 5) {
        examples.push(`${lead.name}: ${previous} -> ${score}`);
      }
    }

    if (reviewCount === 0 && score === lead.score) continue;
    repaired++;

    if (apply) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          reviewCount,
          score,
          reason: lead.province ? `${reason} · ${lead.province}` : reason,
        },
      });
    }
  }

  console.log(`leads bekeken: ${leads.length}`);
  console.log(`${apply ? "hersteld" : "te herstellen"}: ${repaired}`);
  console.log(`nog steeds lager dan voorheen: ${stillLower}`);
  examples.forEach((e) => console.log("  " + e));
  if (!apply) console.log("Proefdraai. Draai opnieuw met --apply.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await backup.$disconnect();
  });
