import { scanZoneCandidates, SPECIALIST_CAP } from "../src/lib/osm";
import { scoreLead } from "../src/lib/detection";
import { DEFAULT_DETECTION_CATEGORIES } from "../src/lib/constants";

/**
 * Bewijst dat afhaalzaken de specialisten niet meer wegdrukken.
 *
 * Er zijn twee manieren waarop dat kon gebeuren, en ze vragen elk hun eigen
 * controle:
 *
 * 1. **Afkappen.** Alle categorieën deelden één Overpass-vraag met één
 *    resultaatplafond. In een dichte tegel vulden de frituren dat plafond.
 *    Getoetst door te kijken of de specialistenvraag onder haar plafond blijft;
 *    zit ze eraan, dan is er afgekapt en zijn er zaken verdwenen.
 *
 * 2. **Verdrinken in de lijst.** Ook zonder afkappen staan er tien keer zoveel
 *    frituren dan patisserieën, en dan zie je de patisserie niet meer. Dat is
 *    geen zoekprobleem maar een rangschikkingsprobleem, en het wordt opgelost
 *    door het gewicht per categorie. Getoetst door de mediane score van beide
 *    groepen te vergelijken.
 *
 * De twee scans zijn losse live-bevragingen; OpenStreetMap-spiegels lopen
 * onderling een paar knooppunten uiteen, dus een verschil van één of twee zegt
 * niets. Alleen een structureel verschil telt.
 *
 * Draaien met: npx tsx scripts/smoke-takeaway-scan.ts [gemeente]
 */

const ZONE = "West-Vlaanderen";
const TOWN = process.argv[2] || "Kortrijk";

const SPECIALISTS = DEFAULT_DETECTION_CATEGORIES.filter((c) => c !== "takeaway");

function summarise(candidates: Array<{ category: string }>) {
  const counts = new Map<string, number>();
  for (const c of candidates) {
    counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

async function main() {
  console.log(`Gemeente: ${TOWN}\n`);

  const withoutTakeaway = await scanZoneCandidates(ZONE, [...SPECIALISTS], [TOWN]);
  const specialistsAlone = withoutTakeaway.candidates.length;
  console.log(`zonder afhaal: ${specialistsAlone} specialisten`);
  for (const [category, count] of summarise(withoutTakeaway.candidates)) {
    console.log(`   ${String(count).padStart(4)}  ${category}`);
  }

  const withTakeaway = await scanZoneCandidates(
    ZONE,
    [...DEFAULT_DETECTION_CATEGORIES],
    [TOWN]
  );
  const stillSpecialists = withTakeaway.candidates.filter(
    (c) => c.category !== "takeaway"
  ).length;
  const takeaways = withTakeaway.candidates.length - stillSpecialists;

  console.log(`\nmet afhaal: ${withTakeaway.candidates.length} totaal`);
  for (const [category, count] of summarise(withTakeaway.candidates)) {
    console.log(`   ${String(count).padStart(4)}  ${category}`);
  }

  const flagged = withTakeaway.candidates.filter((c) => c.sellsTakeaway).length;
  const nearby = withTakeaway.candidates.filter((c) => c.nearbyVending > 0).length;
  console.log(`\nverkoopt afhaal (tag):  ${flagged}`);
  console.log(`automaat in de buurt:   ${nearby}`);

  console.log(
    `\nspecialisten zonder afhaal: ${specialistsAlone} · met afhaal: ${stillSpecialists} · afhaalzaken erbij: ${takeaways}`
  );

  let failed = false;

  // 1 · Afkappen. Blijft de specialistenvraag ruim onder haar plafond, dan kan
  // er niets weggevallen zijn, hoeveel frituren er ook bij komen.
  console.log(
    `\n[1] specialisten ${stillSpecialists} van plafond ${SPECIALIST_CAP} — ` +
      (stillSpecialists < SPECIALIST_CAP * 0.9
        ? "GOED: ruim onder het plafond, er kan niets afgekapt zijn."
        : "LET OP: tegen het plafond aan, hier kan wél afgekapt worden.")
  );
  if (stillSpecialists >= SPECIALIST_CAP * 0.9) failed = true;

  const drift = specialistsAlone - stillSpecialists;
  console.log(
    `    verschil tussen de twee scans: ${drift} ` +
      (Math.abs(drift) <= 2
        ? "(binnen de ruis van OpenStreetMap-spiegels)"
        : "(te groot om ruis te zijn)")
  );
  if (Math.abs(drift) > 2) failed = true;

  // 2 · Rangschikking. Het gewicht per categorie moet de specialist boven de
  // frituur zetten, anders staan er honderd frituren voor de patisserie.
  const scoreOf = (c: { category: string; phone: string | null }) =>
    scoreLead({ category: c.category, phone: c.phone }).score;
  const median = (values: number[]) =>
    values.length
      ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
      : 0;

  const specialistScores = median(
    withTakeaway.candidates.filter((c) => c.category !== "takeaway").map(scoreOf)
  );
  const takeawayScores = median(
    withTakeaway.candidates.filter((c) => c.category === "takeaway").map(scoreOf)
  );

  console.log(
    `\n[2] mediane score specialist ${specialistScores} vs afhaal ${takeawayScores} — ` +
      (specialistScores > takeawayScores
        ? "GOED: specialisten staan boven de afhaalzaken."
        : "MISLUKT: afhaal rangschikt gelijk of hoger.")
  );
  if (specialistScores <= takeawayScores) failed = true;

  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
