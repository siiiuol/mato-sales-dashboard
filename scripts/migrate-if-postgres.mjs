/**
 * Run Prisma migrate deploy only when DATABASE_URL is a real Postgres URL.
 * Skips locally when Cursor/Vercel CLI redacts secrets to "[SENSITIVE]".
 */
import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "";
const ok =
  (url.startsWith("postgres://") || url.startsWith("postgresql://")) &&
  !url.includes("[SENSITIVE]");

if (!ok) {
  console.log(
    "Skip prisma migrate deploy (DATABASE_URL is not a usable Postgres URL in this environment)."
  );
  process.exit(0);
}

const result = spawnSync(
  "npx",
  ["prisma", "migrate", "deploy", "--schema", "prisma/schema.postgresql.prisma"],
  { stdio: "inherit", shell: true, env: process.env }
);

process.exit(result.status ?? 1);
