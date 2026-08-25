import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backupDir = resolve(process.env.BACKUP_DIR || join(root, "backups"));
const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL of DIRECT_URL ontbreekt");
}

await mkdir(backupDir, { recursive: true });

const now = new Date();
const stamp = now.toISOString().replace(/[:.]/g, "-");
const isSqlite = databaseUrl.startsWith("file:");
const extension = isSqlite ? "sqlite" : "dump";
const target = join(backupDir, `mato-${stamp}.${extension}`);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    throw new Error(`${command} kon niet starten: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} mislukte: ${result.stderr || result.stdout}`);
  }
}

if (isSqlite) {
  const raw = decodeURIComponent(databaseUrl.slice("file:".length));
  const source = isAbsolute(raw) ? raw : resolve(root, "prisma", raw);
  run("sqlite3", [source, `.backup "${target.replaceAll('"', '""')}"`]);
} else {
  run("pg_dump", [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    "--file",
    target,
    databaseUrl,
  ]);
}

const bytes = await readFile(target);
const checksum = createHash("sha256").update(bytes).digest("hex");
const checksumText = `${checksum}  ${basename(target)}\n`;
await writeFile(`${target}.sha256`, checksumText, "utf8");

const backupFiles = (await readdir(backupDir))
  .filter((name) => /^mato-.*\.(?:sqlite|dump)$/.test(name))
  .map((name) => join(backupDir, name));

const dailyCutoff = now.getTime() - 35 * 24 * 60 * 60 * 1000;
const monthlyCutoff = now.getTime() - 13 * 31 * 24 * 60 * 60 * 1000;
const monthlyKeep = new Map();
for (const file of backupFiles) {
  const modified = (await stat(file)).mtime;
  if (modified.getTime() >= monthlyCutoff) {
    const month = modified.toISOString().slice(0, 7);
    const previous = monthlyKeep.get(month);
    if (!previous || modified > previous.modified) {
      monthlyKeep.set(month, { file, modified });
    }
  }
}

for (const file of backupFiles) {
  const modified = (await stat(file)).mtime;
  const month = modified.toISOString().slice(0, 7);
  const keepAsMonthly = monthlyKeep.get(month)?.file === file;
  if (modified.getTime() < dailyCutoff && !keepAsMonthly) {
    await rm(file, { force: true });
    await rm(`${file}.sha256`, { force: true });
  }
}

let remotePath = null;
if (process.env.BLOB_READ_WRITE_TOKEN) {
  const { del, list, put } = await import("@vercel/blob");
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const prefix = "database-backups/";
  remotePath = `${prefix}${basename(target)}`;
  await put(remotePath, bytes, {
    access: "private",
    addRandomSuffix: false,
    token,
  });
  await put(`${remotePath}.sha256`, checksumText, {
    access: "private",
    addRandomSuffix: false,
    token,
  });

  const remote = await list({ prefix, limit: 1000, token });
  const remoteMonthlyKeep = new Map();
  for (const blob of remote.blobs.filter((item) => !item.pathname.endsWith(".sha256"))) {
    if (blob.uploadedAt.getTime() >= monthlyCutoff) {
      const month = blob.uploadedAt.toISOString().slice(0, 7);
      const previous = remoteMonthlyKeep.get(month);
      if (!previous || blob.uploadedAt > previous.uploadedAt) {
        remoteMonthlyKeep.set(month, blob);
      }
    }
  }
  const removeUrls = [];
  for (const blob of remote.blobs.filter((item) => !item.pathname.endsWith(".sha256"))) {
    const month = blob.uploadedAt.toISOString().slice(0, 7);
    const keepAsMonthly = remoteMonthlyKeep.get(month)?.url === blob.url;
    if (blob.uploadedAt.getTime() < dailyCutoff && !keepAsMonthly) {
      removeUrls.push(blob.url, `${blob.url}.sha256`);
    }
  }
  if (removeUrls.length) await del(removeUrls, { token });
}

const status = {
  ok: true,
  createdAt: now.toISOString(),
  file: basename(target),
  bytes: bytes.length,
  sha256: checksum,
  database: isSqlite ? "sqlite" : "postgresql",
  retention: { dailyDays: 35, monthlyMonths: 13 },
  remotePath,
};
await writeFile(
  join(backupDir, "status.json"),
  `${JSON.stringify(status, null, 2)}\n`,
  "utf8"
);
if (process.env.BLOB_READ_WRITE_TOKEN) {
  const { put } = await import("@vercel/blob");
  await put(
    "database-backups/status.json",
    `${JSON.stringify(status, null, 2)}\n`,
    {
      access: "private",
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }
  );
}

console.log(`Back-up gemaakt: ${target}`);
console.log(`SHA-256: ${checksum}`);
