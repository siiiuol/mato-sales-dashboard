import { PrismaClient } from "@prisma/client";

const backupUrl =
  "file:C:/Users/louis/AppData/Local/Temp/claude/C--Users-louis-Documents-GitHub-MATO/74f3b4a3-132f-4626-bcd5-80d4dfae3745/scratchpad/dev.db.before-stage-b";

const now = new PrismaClient();
const before = new PrismaClient({ datasources: { db: { url: backupUrl } } });

const after = await now.lead.findMany({
  where: { nearbyVending: { gt: 0 } },
  select: { id: true, name: true, score: true, reason: true },
});

const ids = after.map((l) => l.id);
const old = await before.lead.findMany({
  where: { id: { in: ids } },
  select: { id: true, score: true, reason: true },
});
const oldById = new Map(old.map((l) => [l.id, l]));

let dropped = 0;
let lostSize = 0;
const examples = [];

for (const lead of after) {
  const prev = oldById.get(lead.id);
  if (!prev) continue;
  const hadSize = /grotere zaak/.test(prev.reason ?? "");
  const hasSize = /grotere zaak/.test(lead.reason ?? "");
  if (hadSize && !hasSize) lostSize++;
  if (lead.score < prev.score) {
    dropped++;
    if (examples.length < 5) {
      examples.push(`${lead.name}: ${prev.score} -> ${lead.score}`);
    }
  }
}

console.log(`rescored leads: ${after.length}`);
console.log(`scores that went DOWN: ${dropped}`);
console.log(`lost the "grotere zaak" signal: ${lostSize}`);
examples.forEach((e) => console.log("  " + e));

await now.$disconnect();
await before.$disconnect();
