/**
 * Eenmalige vertaling van bestaande leadteksten.
 *
 * `reason` en `vendingDetail` worden gegenereerd op het moment van scannen en
 * opgeslagen. Leads van vóór de Nederlandse versie dragen nog Engelse tekst;
 * die is zichtbaar op elke leadkaart. Nieuwe scans zijn al Nederlands.
 *
 * Draaien: npx tsx scripts/translate-existing-leads.ts
 */
import { PrismaClient } from "@prisma/client";
import { CATEGORY_LABELS } from "../src/lib/constants";

const prisma = new PrismaClient();

const REASON_PARTS: Record<string, string> = {
  "already has vending": "heeft al een automaat",
  "phone available": "telefoon bekend",
  "no phone": "geen telefoon",
  "size proxy": "grotere zaak",
  "Manual entry": "Handmatig toegevoegd",
};

const VENDING_KINDS: Record<string, string> = {
  bread: "brood",
  milk: "melk",
  food: "voeding",
  eggs: "eieren",
  cheese: "kaas",
  farm_produce: "hoeveproducten",
  "farm produce": "hoeveproducten",
  drinks: "dranken",
  ice_cream: "ijs",
  "ice cream": "ijs",
  pizza: "pizza",
  potatoes: "aardappelen",
  fruit: "fruit",
  vegetables: "groenten",
};

function translateReason(reason: string): string {
  return reason
    .split(" · ")
    .map((part) => {
      const trimmed = part.trim();
      if (REASON_PARTS[trimmed]) return REASON_PARTS[trimmed];
      // Only rewrite a segment that is genuinely a known category. Anything
      // else — the province, for one — must survive untouched, including its
      // capitalisation.
      const key = trimmed.toLowerCase();
      if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
      return trimmed;
    })
    .join(" · ");
}

function translateVending(detail: string): string | null {
  const m = detail.match(/^(.+?) machine on site(?: \(operator: (.+)\))?$/);
  if (!m) return null;
  const kind = VENDING_KINDS[m[1].toLowerCase()] ?? m[1];
  const what = kind === "vending" ? "automaat" : `${kind}automaat`;
  return m[2] ? `${what} aanwezig (uitbater: ${m[2]})` : `${what} aanwezig`;
}

async function main() {
  const leads = await prisma.lead.findMany({
    select: { id: true, reason: true, vendingDetail: true },
  });

  let reasons = 0;
  let vending = 0;

  for (const lead of leads) {
    const data: { reason?: string; vendingDetail?: string } = {};

    if (lead.reason) {
      const next = translateReason(lead.reason);
      if (next !== lead.reason) {
        data.reason = next;
        reasons++;
      }
    }
    if (lead.vendingDetail) {
      const next = translateVending(lead.vendingDetail);
      if (next && next !== lead.vendingDetail) {
        data.vendingDetail = next;
        vending++;
      }
    }
    if (Object.keys(data).length) {
      await prisma.lead.update({ where: { id: lead.id }, data });
    }
  }

  console.log(`leads bekeken: ${leads.length}`);
  console.log(`reden vertaald: ${reasons}`);
  console.log(`automaat-omschrijving vertaald: ${vending}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
