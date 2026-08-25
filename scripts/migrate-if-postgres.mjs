/**
 * Run Prisma migrate deploy only when DATABASE_URL is a real Postgres URL.
 *
 * Existing MATO production DBs were created with `db push` before migrations
 * existed. On P3005 we mark the historical migrations as already applied, then
 * retry so only new migrations (e.g. lead chat) actually run.
 */
import { spawnSync } from "node:child_process";

const SCHEMA = "prisma/schema.postgresql.prisma";

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

/** Migrations that already describe the live schema from earlier db push deploys. */
const BASELINE_MIGRATIONS = [
  "20260824090000_baseline",
  "20260824104500_sales_shop_personalization",
  "20260824115000_lead_profile_enrichment",
];

function run(args) {
  return spawnSync("npx", args, {
    encoding: "utf8",
    shell: true,
    env: process.env,
  });
}

function migrateDeploy() {
  return run(["prisma", "migrate", "deploy", "--schema", SCHEMA]);
}

function printResult(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

let result = migrateDeploy();
printResult(result);

const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
if (result.status !== 0 && /P3005/.test(combined)) {
  console.log(
    "Database is not empty and has no migration history — baselining historical migrations, then retrying."
  );
  for (const name of BASELINE_MIGRATIONS) {
    const resolved = run([
      "prisma",
      "migrate",
      "resolve",
      "--applied",
      name,
      "--schema",
      SCHEMA,
    ]);
    printResult(resolved);
    // Ignore "already recorded" failures; continue.
  }
  result = migrateDeploy();
  printResult(result);
}

process.exit(result.status ?? 1);
