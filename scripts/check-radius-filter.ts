import { PrismaClient } from "@prisma/client";
import { boundingBoxFilter, haversineKm, withinRadius } from "../src/lib/geo";
import { ZONE_TOWNS } from "../src/lib/constants";

/**
 * Controleert de straalfilter tegen een botte telling over álle leads.
 *
 * De pagina doet het in twee stappen — eerst een rechthoek in de database, dan
 * de echte afstand erover — en juist die combinatie kan er stil naast zitten:
 * een te smalle rechthoek laat zaken weg zonder dat iemand het merkt. Dit
 * telt hetzelfde zonder rechthoek en vergelijkt.
 */

const prisma = new PrismaClient();
const TOWN = process.argv[2] || "Roeselare";
const RADIUS = Number(process.argv[3] || 10);

async function main() {
  const centre = Object.values(ZONE_TOWNS)
    .flat()
    .find((t) => t.name === TOWN);
  if (!centre) throw new Error(`onbekende gemeente: ${TOWN}`);

  // Zoals de pagina het doet: rechthoek in de database, dan verfijnen.
  const boxed = await prisma.lead.findMany({
    where: boundingBoxFilter(centre, RADIUS),
    select: { id: true, lat: true, lng: true },
  });
  const viaBox = boxed.filter((l) => withinRadius(centre, l, RADIUS));

  // De botte manier: alles ophalen en meten.
  const every = await prisma.lead.findMany({
    select: { id: true, lat: true, lng: true },
  });
  const viaScan = every.filter((l) => withinRadius(centre, l, RADIUS));

  console.log(`gemeente:            ${TOWN} (${centre.lat}, ${centre.lng})`);
  console.log(`straal:              ${RADIUS} km`);
  console.log(`rechthoek gaf:       ${boxed.length} rijen`);
  console.log(`daarvan binnen:      ${viaBox.length}`);
  console.log(`bot geteld:          ${viaScan.length}`);

  const boxIds = new Set(viaBox.map((l) => l.id));
  const missed = viaScan.filter((l) => !boxIds.has(l.id));

  if (missed.length) {
    console.log(`\nMISLUKT: de rechthoek liet ${missed.length} zaken weg.`);
    for (const lead of missed.slice(0, 5)) {
      const km = haversineKm(centre, { lat: lead.lat!, lng: lead.lng! });
      console.log(`  ${lead.id} op ${km.toFixed(2)} km`);
    }
    process.exitCode = 1;
  } else {
    console.log(`\nGOED: beide manieren geven dezelfde ${viaScan.length} zaken.`);
  }

  const furthest = viaBox.reduce(
    (max, l) => Math.max(max, haversineKm(centre, { lat: l.lat!, lng: l.lng! })),
    0
  );
  console.log(`verste zaak binnen:  ${furthest.toFixed(2)} km (mag niet boven ${RADIUS})`);
  if (furthest > RADIUS) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
