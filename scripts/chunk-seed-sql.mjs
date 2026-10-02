import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(join(root, "scripts/seed-document-templates.sql"), "utf8");
const statements = sql
  .replace(/^BEGIN;\n/, "")
  .replace(/\nCOMMIT;\s*$/, "")
  .split(/\n\n(?=UPDATE|INSERT)/)
  .filter(Boolean);

const outDir = join(root, "scripts/seed-chunks");
mkdirSync(outDir, { recursive: true });
statements.forEach((statement, index) => {
  writeFileSync(join(outDir, `${String(index + 1).padStart(2, "0")}.sql`), statement.trim() + ";\n");
});
console.log(`Wrote ${statements.length} chunks to ${outDir}`);
