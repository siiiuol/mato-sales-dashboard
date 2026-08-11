import { PrismaClient } from "@prisma/client";
import { countNearbyVending, vendingMachines } from "../src/lib/osm";
import { scoreLead } from "../src/lib/detection";
import { FLANDERS_ZONES } from "../src/lib/constants";

/**
 * Vult `nearbyVending` in voor leads die er al staan, en herberekent hun score.
 *
 * Zonder dit zou het concurrentiesignaal pas gaan tellen bij een volgende scan,
 * terwijl de gegevens er al zijn: elke lead heeft coördinaten, en de automaten
 * zijn per provincie in één vraag op te halen. Er hoeft dus geen enkele zaak
 * opnieuw gezocht te worden.
 *
 * `sellsTakeaway` blijft op false voor bestaande leads: dat stond in de
 * OpenStreetMap-tags die bij de oorspronkelijke scan niet bewaard zijn, en
 * gokken is hier erger dan niets weten.
 *
 * Draaien met: npx tsx scripts/backfill-vending-signals.ts [--apply]
 */

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
let changed = 0;
let scoreChanged = 0;

for (const zone of FLANDERS_ZONES) {
  const leads = await prisma.lead.findMany({
    where: { province: zone, lat: { not: null }, lng: { not: null } },
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
      category: true,
      phone: true,
      score: true,
      hasVending: true,
      nearbyVending: true,
      sellsTakeaway: true,
      reason: true,
    },
  });
  if (!leads.length) continue;

  const machines = await vendingMachines(zone);
  if (!machines.length) {
    console.log(`${zone}: geen automaten gevonden, overgeslagen`);
    continue;
  }

  let zoneChanged = 0;
  for (const lead of leads) {
    const nearby = countNearbyVending(
      { lat: lead.lat!, lng: lead.lng! },
      machines
    );
    if (nearby === lead.nearbyVending) continue;

    const { score, reason } = scoreLead({
      category: lead.category ?? "bakery",
      phone: lead.phone,
      hasVending: lead.hasVending,
      nearbyVending: nearby,
      sellsTakeaway: lead.sellsTakeaway,
    });

    zoneChanged++;
    changed++;
    if (score !== lead.score) scoreChanged++;

    if (apply) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          nearbyVending: nearby,
          score,
          // De provincie stond achteraan in de oude reden; die staart blijft.
          reason: `${reason} · ${zone}`,
        },
      });
    }
  }
  console.log(
    `${zone}: ${leads.length} leads, ${machines.length} automaten, ${zoneChanged} bijgewerkt`
  );
}

console.log(
  apply
    ? `Klaar: ${changed} leads bijgewerkt, waarvan ${scoreChanged} met een andere score.`
    : `Proefdraai: ${changed} leads zouden wijzigen, ${scoreChanged} met een andere score. Draai opnieuw met --apply.`
);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
