import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(join(root, "scripts/seed-document-templates.sql"), "utf8");
const parts = sql.split('INSERT INTO "DocumentTemplate"');
const partnerSql =
  parts
    .slice(2)
    .map((chunk, i) => (i === 0 ? chunk : 'INSERT INTO "DocumentTemplate"' + chunk))
    .join("")
    .split("COMMIT;")[0]
    .trim() + "\n";

writeFileSync(
  join(root, "scripts/seed-partner-templates-only.sql"),
  `BEGIN;\n${partnerSql}\nCOMMIT;\n`
);
console.log("partner bytes:", partnerSql.length);
