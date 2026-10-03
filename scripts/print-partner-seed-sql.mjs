import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const { PARTNER_TEMPLATES } = await import(
  pathToFileURL(join(root, "src/lib/partner-templates.ts")).href
);

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

const statements = PARTNER_TEMPLATES.map((t) => {
  return `INSERT INTO "DocumentTemplate" (
  id, code, name, category, language, version, status, "numberPrefix", body, "outputFormats", "effectiveAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  ${sqlString(t.code)},
  ${sqlString(t.name)},
  ${sqlString(t.category)},
  'nl',
  1,
  'MATO_APPROVED',
  ${sqlString(t.prefix)},
  ${sqlString(t.body)},
  'PDF',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentTemplate" WHERE code = ${sqlString(t.code)} AND version = 1
);`;
});

process.stdout.write(statements.join("\n\n"));
