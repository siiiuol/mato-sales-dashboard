import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { documentCategoryLabel, templateStatusLabel } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * De documentsjabloonbibliotheek.
 *
 * Tot nu toe bestond er maar één sjabloon, hardgecodeerd voor het ene
 * verkoopcontract. Dit scherm maakt "we hebben geen sjablonen" niet meer waar
 * — zonder de zwaardere clausule-componist te bouwen die daar ooit bij hoorde
 * en die voor twee sjablonen nog geen nut heeft.
 */
export default async function SjablonenPage() {
  await requirePageUser(["admin"]);

  const templates = await prisma.documentTemplate.findMany({
    orderBy: [{ code: "asc" }, { version: "desc" }],
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      version: true,
      status: true,
      numberPrefix: true,
      updatedAt: true,
    },
  });

  const byCode = new Map<string, typeof templates>();
  for (const t of templates) {
    byCode.set(t.code, [...(byCode.get(t.code) ?? []), t]);
  }

  return (
    <div className="space-y-6 anim-lock max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="label">
            <Link href="/settings" className="hover:text-[var(--accent)]">
              Instellingen
            </Link>
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Documentsjablonen</h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Per code kan er maar één actieve versie zijn — een nieuwe activeren vervangt de
            vorige, de oude versie blijft bewaard bij alle documenten die er ooit uit
            voortkwamen.
          </p>
        </div>
        <Link href="/settings/sjablonen/nieuw" className="btn btn-primary shrink-0">
          Nieuw sjabloon
        </Link>
      </div>

      {templates.length === 0 ? (
        <section className="panel p-6 space-y-3">
          <div className="label text-[var(--accent)]">Nog niets te zien</div>
          <p className="text-sm text-[var(--text-dim)] max-w-prose">
            Er zou hier minstens het verkoopcontract moeten staan — draai <code>npm run
            db:seed</code> als dat ontbreekt.
          </p>
        </section>
      ) : (
        [...byCode.entries()].map(([code, versions]) => (
          <section key={code} className="panel p-4">
            <h2 className="label text-[var(--accent)] mb-3">
              {code} · {documentCategoryLabel(versions[0].category)}
            </h2>
            <ul className="space-y-2 text-sm">
              {versions.map((t) => (
                <li key={t.id} className="flex items-baseline justify-between gap-2">
                  <Link href={`/settings/sjablonen/${t.id}`} className="hover:text-[var(--accent)]">
                    {t.name} <span className="mono text-xs text-[var(--text-dim)]">v{t.version}</span>
                  </Link>
                  <span className="badge">{templateStatusLabel(t.status)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
