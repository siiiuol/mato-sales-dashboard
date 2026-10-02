import { readFileSync } from "fs";

const src = readFileSync(process.argv[2], "utf8");

function grab(name) {
  const decl = src.indexOf(`var ${name}=`);
  const from = src.indexOf("[", decl);
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return JSON.parse(src.slice(from, i + 1));
    }
  }
}

const DOCS = grab("DOCS");
const MODELS = grab("MODELS");
console.log(`DOCS=${DOCS.length} MODELS=${MODELS.length}`);

let stale = 0;
for (const d of DOCS) {
  const fields = [...d.html.matchAll(/data-model="([^"]+)"/g)].map((m) => m[1]);
  // resterende platte modelverwijzingen buiten een data-model span
  const bare = d.html
    .replace(/<span data-model="[^"]+">[^<]*<\/span>/g, "")
    .match(/M1|10\.500|11\.900|14\.399|2\.499/g);
  if (bare) stale += bare.length;
  console.log(
    `${d.use.padEnd(5)} ${d.group.padEnd(10)} ${d.slug.padEnd(26)} spans=${
      fields.length
    } ${fields.join(",") || "-"}${bare ? `  RESTANT: ${bare.join(",")}` : ""}`
  );
}
console.log(`\nachtergebleven platte modelverwijzingen: ${stale}`);
console.log(`patchmarkering: ${src.includes("MATO_WERKBLAD_PATCH_V2")}`);
console.log(`opslagsleutel v2: ${src.includes("mato-studio-v2")}`);
console.log(`filter in html: ${src.includes('id="usefilter"')}`);
