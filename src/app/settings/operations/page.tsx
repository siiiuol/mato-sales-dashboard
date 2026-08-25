import Link from "next/link";
import { requirePageUser } from "@/lib/dal";
import { readBackupStatus } from "@/lib/backup-status";
import { importLeadsCsv } from "@/lib/operations-actions";

export const dynamic = "force-dynamic";

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; skipped?: string }>;
}) {
  await requirePageUser(["admin"]);
  const [status, params] = await Promise.all([
    readBackupStatus(),
    searchParams,
  ]);
  const createdAt = status ? new Date(status.createdAt) : null;
  const now = new Date();
  const ageHours = createdAt
    ? (now.getTime() - createdAt.getTime()) / 3_600_000
    : null;
  const healthy =
    status?.ok === true && ageHours != null && ageHours >= 0 && ageHours <= 36;

  return (
    <div className="space-y-6 anim-lock max-w-4xl">
      <div>
        <Link href="/settings" className="label text-[var(--accent)]">
          ← Instellingen
        </Link>
        <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
          Operationele controle
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Back-upstatus en gecontroleerde CSV-overdracht.
        </p>
      </div>

      <section className="panel p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="label text-[var(--accent)]">Databaseback-up</h2>
            <p className="text-sm text-[var(--text-dim)] mt-1">
              Dagelijks verwacht; ouder dan 36 uur krijgt een waarschuwing.
            </p>
          </div>
          <span className={healthy ? "badge badge-live" : "badge"}>
            {healthy ? "Actueel" : "Controle nodig"}
          </span>
        </div>
        {status && createdAt ? (
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <Stat label="Laatste back-up" value={createdAt.toLocaleString("nl-BE")} />
            <Stat label="Database" value={status.database} />
            <Stat label="Bestand" value={status.file} />
            <Stat label="Grootte" value={formatBytes(status.bytes)} />
            <Stat label="Bron status" value={status.source === "blob" ? "Vercel Blob" : "Lokaal"} />
            <Stat
              label="Retentie"
              value={`${status.retention.dailyDays} dagen + ${status.retention.monthlyMonths} maanden`}
            />
          </dl>
        ) : (
          <p className="text-sm text-[var(--alert)]">
            Nog geen leesbare back-upstatus gevonden. Controleer de dagelijkse
            workflow en BLOB_READ_WRITE_TOKEN.
          </p>
        )}
        <p className="text-xs text-[var(--text-dim)]">
          Herstelprocedure: docs/backup-restore-runbook.md. Een statusmelding
          vervangt de driemaandelijkse hersteltest niet.
        </p>
      </section>

      <section className="panel p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="label text-[var(--accent)]">CSV-export</h2>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            UTF-8 export voor operationele controle. Downloads bevatten
            persoonsgegevens; bewaar ze niet langer dan nodig.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/export?entity=leads" className="btn">
            Leads exporteren
          </a>
          <a href="/api/admin/export?entity=customers" className="btn">
            Klanten exporteren
          </a>
          <a href="/api/admin/export?entity=shop" className="btn">
            Shop exporteren
          </a>
        </div>
      </section>

      <section className="panel p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="label text-[var(--accent)]">Leads importeren</h2>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            CSV met minimaal <span className="mono">name</span> of{" "}
            <span className="mono">naam</span>. Ook ondersteund: adres,
            gemeente, provincie, categorie, telefoon, e-mail, website, bron en
            notities. Nieuwe regels starten als NEW/PENDING; dubbels worden
            overgeslagen.
          </p>
        </div>
        {params.imported != null ? (
          <p className="rounded-lg bg-[var(--ok-soft)] p-3 text-sm">
            {params.imported} leads toegevoegd · {params.skipped ?? "0"} regels
            overgeslagen.
          </p>
        ) : null}
        <form action={importLeadsCsv} className="flex flex-col sm:flex-row gap-2">
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            className="input"
            required
          />
          <button type="submit" className="btn btn-primary">
            Controleren en importeren
          </button>
        </form>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mono mt-1 break-all">{value}</dd>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
