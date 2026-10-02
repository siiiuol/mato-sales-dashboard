/**
 * Generates idempotent SQL to seed DocumentTemplate rows in production.
 * Run: node scripts/export-document-template-seed.mjs > scripts/seed-document-templates.sql
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const { PARTNER_TEMPLATES } = await import(
  pathToFileURL(join(root, "src/lib/partner-templates.ts")).href
);
const { CONTRACT_BODY, CONTRACT_CODE, CONTRACT_PREFIX } = await import(
  pathToFileURL(join(root, "src/lib/contract-template.ts")).href
);

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

const lines = [
  "-- Seed MATO document templates (idempotent)",
  "BEGIN;",
  "",
  `UPDATE "DocumentTemplate" SET status = 'MATO_APPROVED', "numberPrefix" = ${sqlString(CONTRACT_PREFIX)} WHERE code = ${sqlString(CONTRACT_CODE)} AND status <> 'MATO_APPROVED';`,
  "",
];

const allTemplates = [
  {
    code: CONTRACT_CODE,
    name: "Verkoopovereenkomst",
    category: "SALES",
    prefix: CONTRACT_PREFIX,
    body: CONTRACT_BODY,
  },
  ...PARTNER_TEMPLATES.map((t) => ({
    code: t.code,
    name: t.name,
    category: t.category,
    prefix: t.prefix,
    body: t.body,
  })),
];

for (const t of allTemplates) {
  lines.push(`INSERT INTO "DocumentTemplate" (`);
  lines.push(
    `  id, code, name, category, language, version, status, "numberPrefix", body, "outputFormats", "effectiveAt", "createdAt", "updatedAt"`
  );
  lines.push(`)`);
  lines.push(`SELECT`);
  lines.push(`  gen_random_uuid()::text,`);
  lines.push(`  ${sqlString(t.code)},`);
  lines.push(`  ${sqlString(t.name)},`);
  lines.push(`  ${sqlString(t.category)},`);
  lines.push(`  'nl',`);
  lines.push(`  1,`);
  lines.push(`  'MATO_APPROVED',`);
  lines.push(`  ${sqlString(t.prefix)},`);
  lines.push(`  ${sqlString(t.body)},`);
  lines.push(`  'PDF',`);
  lines.push(`  NOW(),`);
  lines.push(`  NOW(),`);
  lines.push(`  NOW()`);
  lines.push(`WHERE NOT EXISTS (`);
  lines.push(
    `  SELECT 1 FROM "DocumentTemplate" WHERE code = ${sqlString(t.code)} AND version = 1`
  );
  lines.push(`);`);
  lines.push("");
}

lines.push("COMMIT;");

const out = join(root, "scripts/seed-document-templates.sql");
writeFileSync(out, lines.join("\n"), "utf8");
console.log(`Wrote ${out} (${allTemplates.length} templates)`);
