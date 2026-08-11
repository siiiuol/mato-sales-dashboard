import { PrismaClient } from "@prisma/client";
import { workableByMe } from "../src/lib/claims";

/**
 * Controleert dat de wachtrij van de één de leads van de ander niet toont.
 *
 * Draait het echte filter uit `claims.ts` tegen de echte database, want de
 * losse eenheidstests bewijzen alleen dat het filter klopt — niet dat het op de
 * juiste plek in de `where` beland is. Precies daar ging het eerder mis: naast
 * een bestaande `OR` gezet in plaats van in de `AND`, en dan verdwijnt het
 * stilletjes.
 */

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const owned = await prisma.lead.findMany({
    where: { ownerId: { not: null } },
    select: { id: true, name: true, ownerId: true, owner: { select: { name: true } } },
  });

  let failures = 0;

  for (const user of users) {
    const visible = await prisma.lead.findMany({
      where: { AND: workableByMe(user.id) },
      select: { id: true },
    });
    const visibleIds = new Set(visible.map((l) => l.id));

    const leaked = owned.filter(
      (lead) => lead.ownerId !== user.id && visibleIds.has(lead.id)
    );

    console.log(
      `${user.name}: ziet ${visible.length} leads` +
        (leaked.length
          ? ` — LEK: ${leaked.map((l) => `${l.name} (van ${l.owner?.name})`).join(", ")}`
          : " — geen leads van collega's")
    );
    failures += leaked.length;

    const ownLeads = owned.filter((lead) => lead.ownerId === user.id);
    const missing = ownLeads.filter((lead) => !visibleIds.has(lead.id));
    if (missing.length) {
      console.log(
        `   FOUT: eigen leads niet zichtbaar: ${missing.map((l) => l.name).join(", ")}`
      );
      failures += missing.length;
    }
  }

  console.log(failures === 0 ? "\nGOED: geen enkele overlap." : `\nMISLUKT: ${failures}`);
  if (failures) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
