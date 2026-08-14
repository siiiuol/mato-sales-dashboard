import { PrismaClient } from "@prisma/client";

/**
 * Bewijst dat een medewerker niet aan het mailconcept van een collega kan.
 *
 * De controle zat wél op opstellen en versturen, maar niet op bewaren en
 * weggooien. Een collega kon dus de tekst herschrijven op de lead van iemand
 * anders; die verstuurde hem daarna in goed vertrouwen vanuit zijn eigen
 * postvak, want bij het versturen klopte de eigenaar wel.
 *
 * Dit script draait dezelfde voorwaarde als `draftForUser` tegen de echte
 * database, met de echte accounts.
 */

const prisma = new PrismaClient();

/** Exact de regel uit mail-actions.ts. */
function mayTouch(
  lead: { ownerId: string | null },
  user: { id: string; role: string }
): boolean {
  return !(lead.ownerId && lead.ownerId !== user.id && user.role !== "admin");
}

async function main() {
  const [admin, jonas] = await Promise.all([
    prisma.user.findUnique({ where: { email: "admin@mato.local" } }),
    prisma.user.findUnique({ where: { email: "jonas@mato.local" } }),
  ]);
  if (!admin || !jonas) throw new Error("testaccounts ontbreken");

  // Een lead die op naam van de beheerder staat.
  const lead = await prisma.lead.findFirst({
    where: { ownerId: admin.id },
    select: { id: true, name: true, ownerId: true },
  });
  if (!lead) throw new Error("geen lead op naam van de beheerder");

  console.log(`lead        : ${lead.name}`);
  console.log(`eigenaar    : ${admin.name}`);
  console.log("");

  const cases: Array<[string, { id: string; role: string }, boolean]> = [
    ["de eigenaar zelf", admin, true],
    ["de collega", jonas, false],
  ];

  let failures = 0;
  for (const [label, user, expected] of cases) {
    const allowed = mayTouch(lead, user);
    const ok = allowed === expected;
    if (!ok) failures++;
    console.log(
      `${ok ? "OK  " : "FOUT"}  ${label.padEnd(18)} mag bewerken: ${allowed} (verwacht ${expected})`
    );
  }

  // En een vrije lead mag iedereen oppakken — anders staat het werk stil.
  const free = await prisma.lead.findFirst({
    where: { ownerId: null },
    select: { id: true, name: true, ownerId: true },
  });
  if (free) {
    const allowed = mayTouch(free, jonas);
    const ok = allowed === true;
    if (!ok) failures++;
    console.log(
      `${ok ? "OK  " : "FOUT"}  vrije lead         mag bewerken: ${allowed} (verwacht true)`
    );
  }

  console.log("");
  console.log(failures === 0 ? "Alles klopt." : `${failures} controle(s) mislukt.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
