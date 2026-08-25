import Link from "next/link";
import { requirePageUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { statusLabel } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Assistent-hub in MATO OS — één plek voor AI die naar koop/huur closes leidt.
 */
export default async function AiosHubPage() {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const canRun = user.role === "admin" || user.role === "sales";

  const openLeads = canRun
    ? await prisma.lead.findMany({
        where: {
          ownerId: user.id,
          status: { in: ["NEW", "TO_CALL", "CONTACTED", "FOLLOW_UP", "NEGOTIATION"] },
        },
        orderBy: [{ nextActionAt: "asc" }, { score: "desc" }],
        take: 8,
        select: {
          id: true,
          name: true,
          city: true,
          status: true,
          nextActionAt: true,
        },
      })
    : [];

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label text-[var(--accent)]">MATO OS</p>
        <h1 className="display text-3xl tracking-tight">
          Assistent
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--text-dim)]">
          Helpt je producten verkopen of een automaat in de shop verhuren.
          Werkt met jouw leads in dit dashboard — geen aparte app.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ToolCard
          href="/aios/ochtendbrief"
          title="Ochtendbrief"
          body="Wat vandaag naar een close moet: open leads, due taken, koop of huur."
          cta="Openen"
        />
        <ToolCard
          href="/aios/content"
          title="Contentideeën"
          body="Ideeën die productverkoop of automaathuur promoten — geen AI-praat."
          cta="Openen"
        />
        <ToolCard
          href="/reclame/materiaal"
          title="PDF-sjablonen"
          body="Partnerschap, factuur, welkom, leveringsgids en meer — downloadklare huisstijl."
          cta="Naar Materiaal"
        />
        <ToolCard
          href="/"
          title="Brief & voorstel"
          body="Open een leadfiche. Rechts staat Assistent: zaak-brief of voorstel (koop/huur), daarna opslaan."
          cta="Naar mijn leads"
        />
      </div>

      {canRun && (
        <section className="panel p-4 space-y-3">
          <h2 className="label text-[var(--accent)]">Snel naar een fiche</h2>
          {openLeads.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">
              Nog geen open leads op jouw naam.{" "}
              <Link href="/leads" className="text-[var(--accent)] underline">
                Zoek en claim
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {openLeads.map((lead) => (
                <li key={lead.id} className="py-2 flex items-center justify-between gap-3">
                  <div>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium hover:text-[var(--accent)]"
                    >
                      {lead.name}
                    </Link>
                    <p className="text-xs text-[var(--text-dim)]">
                      {lead.city ?? "—"} · {statusLabel(lead.status)}
                      {lead.nextActionAt
                        ? ` · actie ${lead.nextActionAt.toLocaleDateString("nl-BE")}`
                        : ""}
                    </p>
                  </div>
                  <Link href={`/leads/${lead.id}`} className="btn text-sm shrink-0">
                    Assistent
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!canRun && (
        <p className="text-sm text-[var(--text-dim)]">
          Als meelezer kun je fiches bekijken; opstellen doet Verkoop of Beheerder.
        </p>
      )}
    </div>
  );
}

function ToolCard({
  href,
  title,
  body,
  cta,
}: {
  href: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="panel p-5 flex flex-col gap-3 hover:border-[var(--accent-dim)] transition-colors"
    >
      <h2 className="display text-xl">{title}</h2>
      <p className="text-sm text-[var(--text-dim)] flex-1">{body}</p>
      <span className="text-sm text-[var(--accent)]">{cta} →</span>
    </Link>
  );
}
