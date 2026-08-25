import Link from "next/link";
import { requirePageUser } from "@/lib/dal";
import { searchEverything } from "@/lib/search";
import { searchTypeLabel } from "@/lib/search-types";

export const dynamic = "force-dynamic";

export default async function ZoekenPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const { q = "" } = await searchParams;
  const hits = q.trim().length >= 2 ? await searchEverything(q, 60) : [];

  return (
    <div className="space-y-6 anim-lock max-w-3xl">
      <div>
        <p className="label">Overzicht</p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Zoeken</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Leads, klanten, huurders, automaten, contracten, deals en open taken.
          Tip: ⌘K / Ctrl+K overal in de app.
        </p>
      </div>

      <form className="panel p-4 flex flex-col sm:flex-row gap-2">
        <input
          name="q"
          className="input flex-1"
          defaultValue={q}
          placeholder="Naam, serienummer, shopplaats, contract of taak…"
          autoFocus
        />
        <button type="submit" className="btn btn-primary shrink-0">
          Zoeken
        </button>
      </form>

      {q.trim().length > 0 && q.trim().length < 2 ? (
        <p className="text-sm text-[var(--text-dim)]">Typ minstens 2 tekens.</p>
      ) : null}

      {q.trim().length >= 2 ? (
        hits.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">Niets gevonden voor “{q.trim()}”.</p>
        ) : (
          <ul className="panel divide-y divide-[var(--border)]">
            {hits.map((hit) => (
              <li key={`${hit.type}-${hit.id}`}>
                <Link
                  href={hit.href}
                  className="flex items-start gap-3 p-4 hover:bg-[var(--surface-2)]"
                >
                  <span className="badge shrink-0 mt-0.5">
                    {searchTypeLabel(hit.type)}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{hit.title}</span>
                    <span className="block text-sm text-[var(--text-dim)]">
                      {hit.subtitle}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
