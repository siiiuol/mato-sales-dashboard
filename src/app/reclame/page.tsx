import { requirePageUser } from "@/lib/dal";

export const dynamic = "force-dynamic";

/**
 * De voorpagina van de sectie Reclame.
 *
 * Voorlopig alleen de lege stand: er is nog geen campagne, en dat is bij een
 * nieuwe sectie de gewone toestand. Wat hier komt te staan is het antwoord op
 * één vraag — wat levert de reclame op — en die vraag hoort al leesbaar te zijn
 * voordat er cijfers zijn.
 */
export default async function ReclamePage() {
  await requirePageUser(["admin", "sales", "reviewer"]);

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">Reclame</p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">
          Wat levert de reclame op?
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Campagnes, wat ze kosten, en welke zaken erdoor binnenkwamen.
        </p>
      </div>

      <section className="panel p-6 space-y-3">
        <div className="label text-[var(--accent)]">Nog niets te zien</div>
        <p className="text-sm text-[var(--text-dim)] max-w-prose">
          Er loopt nog geen reclame in het systeem. Maak een campagne aan zodra
          je ergens geld aan uitgeeft — een Meta-advertentie, een flyerronde,
          een beurs. Vanaf dan zie je hier wat ze opbracht.
        </p>
      </section>
    </div>
  );
}
