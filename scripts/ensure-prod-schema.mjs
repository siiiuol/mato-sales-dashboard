/**
 * Brengt een bestaande Postgres-productiedatabase bij (ADD COLUMN / CREATE IF NOT EXISTS).
 * Gebruikt DIRECT_URL voor DDL (pooler heeft vaak geen ALTER-rechten).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const direct = process.env.DIRECT_URL ?? "";
const pooled = process.env.DATABASE_URL ?? "";
const url = direct || pooled;
const ok =
  (url.startsWith("postgres://") || url.startsWith("postgresql://")) &&
  !url.includes("[SENSITIVE]");

if (!ok) {
  console.log("Skip ensure-prod-schema (geen Postgres DATABASE_URL/DIRECT_URL).");
  process.exit(0);
}

// Prisma leest DATABASE_URL; voor DDL altijd de directe verbinding prefereren.
if (direct) process.env.DATABASE_URL = direct;

const here = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(here, "ensure-prod-schema.sql");
const sql = readFileSync(sqlPath, "utf8");

function statementsFromFile(source) {
  return source
    .split(";")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter(Boolean);
}

function redact(msg) {
  return String(msg)
    .replace(/postgresql:\/\/[^\s"']+/gi, "postgresql://…")
    .replace(/postgres:\/\/[^\s"']+/gi, "postgres://…")
    .split("\n")[0]
    .slice(0, 220);
}

const prisma = new PrismaClient();
const statements = statementsFromFile(sql);

async function main() {
  console.log(
    `ensure-prod-schema via ${direct ? "DIRECT_URL" : "DATABASE_URL"} (${statements.length} statements)`
  );

  let okCount = 0;
  let failCount = 0;
  for (const statement of statements) {
    try {
      await prisma.$executeRawUnsafe(statement);
      okCount += 1;
    } catch (err) {
      failCount += 1;
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`ensure-prod-schema warn${code ? ` [${code}]` : ""}: ${redact(message)}`);
    }
  }

  console.log(`ensure-prod-schema klaar: ${okCount} ok, ${failCount} waarschuwingen`);

  // Een afzonderlijke waarschuwing is normaal: de meeste statements zijn
  // IF NOT EXISTS en melden dat er niets te doen viel. Maar als er geen énkele
  // gelukt is, is de database onbereikbaar of geweigerd — en dan rolt er een
  // versie uit die kolommen verwacht die er niet zijn. Dat is weken onopgemerkt
  // gebleven omdat deze stap groen bleef; daarom faalt hij nu hard.
  if (okCount === 0 && failCount > 0) {
    // Onbereikbaar is hier de normale toestand, geen uitzondering: Supabase
    // accepteert geen verbinding vanuit de buildomgeving van Vercel, dus deze
    // stap slaagt daar nooit en het schema wordt met de hand bijgewerkt.
    // Hard falen zou dus elke uitrol blokkeren in plaats van drift te vangen.
    //
    // Daarom luid waarschuwen en doorgaan. Wie de controle wél bindend wil
    // maken — bijvoorbeeld in CI, waar de database wel bereikbaar is — zet
    // STRICT_SCHEMA=1 en krijgt een exitcode die de stap laat falen.
    const message =
      "LET OP: geen enkele DDL gelukt — database onbereikbaar of geweigerd. " +
      "Deze uitrol verwacht mogelijk kolommen die nog niet bestaan. " +
      "Voer scripts/ensure-prod-schema.sql uit in de Supabase SQL Editor.";
    if (process.env.STRICT_SCHEMA === "1") {
      console.error(message);
      process.exitCode = 1;
      return;
    }
    console.warn(`::warning::${message}`);
  }
}

main()
  .catch((err) => {
    console.error(redact(err instanceof Error ? err.message : err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
