import { requirePageUser } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function DocumentenPage() {
  await requirePageUser(["admin", "sales", "reviewer"]);

  return (
    <div className="mx-auto max-w-lg space-y-5 anim-lock">
      <div>
        <p className="label">Documenten</p>
        <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
          Verhuur of verkoop
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Kies het traject. In het werkblad volgt de tekst het gekozen model.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href="/klantdocumenten/werkblad.html?use=huur"
          className="doc-tray"
        >
          <span className="label text-[var(--accent)]">Verhuur</span>
          <span className="mt-2 text-xl font-semibold">Automatenshop</span>
          <span className="mt-1 text-sm text-[var(--text-dim)]">
            Partner in Diksmuide. Tekst volgt het gekozen model.
          </span>
        </a>
        <a
          href="/klantdocumenten/werkblad.html?use=koop"
          className="doc-tray"
        >
          <span className="label text-[var(--accent)]">Verkoop</span>
          <span className="mt-2 text-xl font-semibold">Automaat</span>
          <span className="mt-1 text-sm text-[var(--text-dim)]">
            Aankoop van een automaat. Zelfde werkblad, andere documenten.
          </span>
        </a>
      </div>
    </div>
  );
}
