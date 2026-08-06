/**
 * One-shot OSM detection smoke test (no Next server actions).
 * Run: npx tsx scripts/smoke-osm-scan.ts
 */
import { PrismaClient } from "@prisma/client";
import { runDetection } from "../src/lib/detection";

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  console.log("placesApiKey empty?", !settings.placesApiKey?.trim());
  const result = await runDetection(prisma, "Oost-Vlaanderen", settings);
  console.log(result);
  const withCoords = await prisma.lead.count({
    where: { province: "Oost-Vlaanderen", lat: { not: null }, lng: { not: null } },
  });
  console.log("leads with coords in Oost-Vlaanderen:", withCoords);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
