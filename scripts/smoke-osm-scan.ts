/**
 * One-shot OSM discovery smoke test (no Next server, no DB writes).
 *
 * Proves the scan actually covers a whole province rather than one city, and
 * reports the phone-number rate — the number that decides whether a lead is
 * callable at all.
 *
 * Run: npx tsx scripts/smoke-osm-scan.ts [zone] [expectedName]
 */
import { scanZoneCandidates } from "../src/lib/osm";

const zone = process.argv[2] || "West-Vlaanderen";
const expect = process.argv[3] || "zoete zonde";

async function main() {
  console.log(`Scanning ${zone} …`);
  const started = Date.now();
  const { candidates, townsOk, townsFailed, townsTotal } =
    await scanZoneCandidates(zone, []);
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`\ntown coverage    ${townsOk}/${townsTotal} ok`);
  if (townsFailed.length) console.log(`failed towns     ${townsFailed.join(", ")}`);

  const withPhone = candidates.filter((c) => c.phone);
  const withSite = candidates.filter((c) => c.website);
  const vending = candidates.filter((c) => c.hasVending);
  const cities = new Set(candidates.map((c) => c.city).filter(Boolean));
  const byCategory = candidates.reduce<Record<string, number>>((acc, c) => {
    acc[c.category] = (acc[c.category] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\nfound            ${candidates.length} businesses in ${seconds}s`);
  console.log(
    `with phone       ${withPhone.length} (${Math.round((withPhone.length / Math.max(candidates.length, 1)) * 100)}%)`
  );
  console.log(`with website     ${withSite.length}`);
  console.log(`distinct cities  ${cities.size}`);
  console.log(`already vending  ${vending.length}`);
  console.log(`\nby category:`);
  for (const [k, v] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(14)} ${v}`);
  }

  if (vending.length) {
    console.log(`\nbusinesses already running a machine (top prospects):`);
    for (const c of vending.slice(0, 8)) {
      console.log(`  - ${c.name} · ${c.city} · ${c.vendingDetail}`);
    }
  }

  const hit = candidates.filter((c) =>
    c.name.toLowerCase().includes(expect.toLowerCase())
  );
  console.log(`\n"${expect}" matches: ${hit.length}`);
  for (const c of hit) {
    console.log(
      `  -> ${c.name} | ${c.category} | ${c.city} | ${c.address ?? "no address"} | ${c.phone ?? "no phone"}`
    );
  }
  if (!hit.length) {
    console.log(`  NOT FOUND — investigate before assuming the code is wrong.`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
