import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type BackupStatus = {
  ok: boolean;
  createdAt: string;
  file: string;
  bytes: number;
  sha256: string;
  database: string;
  retention: { dailyDays: number; monthlyMonths: number };
  remotePath: string | null;
  source: "blob" | "local";
};

export async function readBackupStatus(): Promise<BackupStatus | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    try {
      const { get } = await import("@vercel/blob");
      const result = await get("database-backups/status.json", {
        access: "private",
        token,
        useCache: false,
      });
      if (result?.statusCode === 200) {
        const text = await new Response(result.stream).text();
        const parsed = parseStatus(text);
        if (parsed) return { ...parsed, source: "blob" };
      }
    } catch {
      // De lokale status hieronder blijft bruikbaar voor ontwikkeling.
    }
  }
  try {
    const text = await readFile(
      resolve(process.cwd(), "backups", "status.json"),
      "utf8"
    );
    const parsed = parseStatus(text);
    return parsed ? { ...parsed, source: "local" } : null;
  } catch {
    return null;
  }
}

function parseStatus(value: string): Omit<BackupStatus, "source"> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const row = parsed as Record<string, unknown>;
    if (
      row.ok !== true ||
      typeof row.createdAt !== "string" ||
      typeof row.file !== "string" ||
      typeof row.bytes !== "number" ||
      typeof row.sha256 !== "string" ||
      typeof row.database !== "string"
    ) {
      return null;
    }
    const retention = row.retention as Record<string, unknown> | undefined;
    if (
      !retention ||
      typeof retention.dailyDays !== "number" ||
      typeof retention.monthlyMonths !== "number"
    ) {
      return null;
    }
    return {
      ok: true,
      createdAt: row.createdAt,
      file: row.file,
      bytes: row.bytes,
      sha256: row.sha256,
      database: row.database,
      retention: {
        dailyDays: retention.dailyDays,
        monthlyMonths: retention.monthlyMonths,
      },
      remotePath: typeof row.remotePath === "string" ? row.remotePath : null,
    };
  } catch {
    return null;
  }
}
