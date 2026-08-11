import { PrismaClient } from "@prisma/client";
import { formatDocumentNumber, sequenceId } from "../src/lib/documents";

/**
 * Vraagt in één keer veel nummers tegelijk aan en kijkt of er dubbele bij zitten.
 *
 * Een documentnummer dat twee keer bestaat valt in de boekhouding pas maanden
 * later op, en dan is niet meer te achterhalen welke van de twee de echte was.
 * De teller wordt daarom met één upsert opgehoogd; dit bewijst dat dat ook
 * onder gelijktijdige aanvragen standhoudt.
 */

const prisma = new PrismaClient();
const PREFIX = "TEST-GELIJKTIJDIG";
const YEAR = 2026;
const HOWMANY = 60;

async function allocate(): Promise<string> {
  const sequence = await prisma.documentSequence.upsert({
    where: { id: sequenceId(PREFIX, YEAR) },
    create: { id: sequenceId(PREFIX, YEAR), prefix: PREFIX, year: YEAR, counter: 1 },
    update: { counter: { increment: 1 } },
  });
  return formatDocumentNumber(PREFIX, YEAR, sequence.counter);
}

async function main() {
  await prisma.documentSequence.deleteMany({ where: { prefix: PREFIX } });

  const numbers = await Promise.all(
    Array.from({ length: HOWMANY }, () => allocate())
  );

  const unique = new Set(numbers);
  console.log(`aangevraagd: ${HOWMANY}`);
  console.log(`uniek:       ${unique.size}`);

  const counters = numbers
    .map((n) => Number(n.split("-").pop()))
    .sort((a, b) => a - b);
  const gaps = counters.filter((value, index) => value !== index + 1);

  console.log(`laagste:     ${counters[0]}`);
  console.log(`hoogste:     ${counters[counters.length - 1]}`);
  console.log(`gaten:       ${gaps.length}`);

  await prisma.documentSequence.deleteMany({ where: { prefix: PREFIX } });

  if (unique.size !== HOWMANY) {
    console.log("\nMISLUKT: er zijn dubbele nummers uitgegeven.");
    process.exitCode = 1;
  } else if (gaps.length) {
    console.log("\nMISLUKT: de reeks heeft gaten.");
    process.exitCode = 1;
  } else {
    console.log("\nGOED: alle nummers uniek en aaneensluitend.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
