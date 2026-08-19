import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { MAIL_SITUATIONS, mailSituationLabel } from "@/lib/constants";
import { NewMailSnippetForm, MailSnippetRow } from "@/components/MailSnippetForm";

export const dynamic = "force-dynamic";

/**
 * De mailtekst-bibliotheek — herbruikbare startteksten per situatie.
 *
 * Los van `AppSettings.pitchTemplates` (belscripts, een JSON-blob voor tijdens
 * een gesprek): dit hier is structuur, met een kiezer en per-tekst bewerking,
 * omdat het gekozen wordt tijdens het opstellen van een mail — niet iets om
 * live uit een tekstvak te lezen.
 */
export default async function MailTekstenPage() {
  await requirePageUser(["admin"]);

  const snippets = await prisma.mailSnippet.findMany({
    where: { active: true },
    orderBy: [{ situation: "asc" }, { label: "asc" }],
    select: { id: true, situation: true, label: true, body: true },
  });

  const bySituation = new Map<string, typeof snippets>();
  for (const s of snippets) {
    bySituation.set(s.situation, [...(bySituation.get(s.situation) ?? []), s]);
  }

  return (
    <div className="space-y-6 anim-lock max-w-3xl">
      <div>
        <p className="label">
          <Link href="/settings" className="hover:text-[var(--accent)]">
            Instellingen
          </Link>
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Mailteksten</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Herbruikbare vertrekpunten per situatie. Bij het opstellen van een mail kan een
          medewerker er één kiezen — de AI past hem aan op de feiten van die zaak, verzint
          er niets bij.
        </p>
      </div>

      {snippets.length === 0 ? (
        <section className="panel p-6 space-y-3">
          <div className="label text-[var(--accent)]">Nog niets te zien</div>
          <p className="text-sm text-[var(--text-dim)] max-w-prose">
            Voeg hieronder een eerste tekst toe — bijvoorbeeld voor een eerste contact met
            een bakkerij.
          </p>
        </section>
      ) : (
        MAIL_SITUATIONS.map((situation) => {
          const items = bySituation.get(situation.value);
          if (!items?.length) return null;
          return (
            <section key={situation.value} className="panel p-4">
              <h2 className="label text-[var(--accent)] mb-3">{mailSituationLabel(situation.value)}</h2>
              <ul className="space-y-3">
                {items.map((s) => (
                  <MailSnippetRow key={s.id} snippet={s} />
                ))}
              </ul>
            </section>
          );
        })
      )}

      <section className="panel p-4 space-y-3">
        <h2 className="label text-[var(--accent)]">Nieuwe tekst</h2>
        <NewMailSnippetForm />
      </section>
    </div>
  );
}
