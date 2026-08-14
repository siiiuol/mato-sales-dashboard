import { cleanEmail } from "../src/lib/osm";

/**
 * Kijkt hoeveel zaken in West-Vlaanderen een mailadres op OpenStreetMap hebben.
 *
 * Zonder mailadres kan de mailfunctie niets: het "Naar"-veld blijft leeg en een
 * antwoord is nooit op afzender terug te vinden. Dit script zegt of het de
 * moeite is voordat er een scan over de hele database gaat.
 */

const OVERPASS = "https://overpass-api.de/api/interpreter";

// Roeselare en omgeving: dezelfde doos die de scan gebruikt.
const BOX = "50.86,3.05,51.00,3.30";

const ql = `[out:json][timeout:60];
(
  nwr["shop"~"^(bakery|pastry|butcher|confectionery|chocolate|ice_cream|deli|farm|greengrocer)$"](${BOX});
  nwr["amenity"~"^(fast_food|cafe|restaurant)$"](${BOX});
);
out center 800;`;

async function main() {
  const response = await fetch(OVERPASS, {
    method: "POST",
    body: `data=${encodeURIComponent(ql)}`,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      // Overpass antwoordt met 406 zonder herkenbare user-agent.
      "user-agent": "MATO-Dashboard/1.0 (local lead discovery)",
    },
  });

  if (!response.ok) {
    console.error(`Overpass gaf ${response.status}`);
    process.exit(1);
  }

  const data = (await response.json()) as {
    elements: Array<{ tags?: Record<string, string> }>;
  };

  let withEmail = 0;
  let rejected = 0;
  const samples: string[] = [];

  for (const el of data.elements) {
    const tags = el.tags ?? {};
    const raw = tags.email || tags["contact:email"];
    if (!raw) continue;

    const cleaned = cleanEmail(raw);
    if (cleaned) {
      withEmail++;
      if (samples.length < 8) samples.push(`${tags.name ?? "?"} — ${cleaned}`);
    } else {
      rejected++;
      console.log(`  geweigerd: ${JSON.stringify(raw)}`);
    }
  }

  const total = data.elements.length;
  console.log(`zaken gevonden       : ${total}`);
  console.log(
    `met bruikbaar adres  : ${withEmail} (${((withEmail / total) * 100).toFixed(1)}%)`
  );
  console.log(`onbruikbaar geweigerd: ${rejected}`);
  console.log("");
  for (const s of samples) console.log(`  ${s}`);
}

void main();
