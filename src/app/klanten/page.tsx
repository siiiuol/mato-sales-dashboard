import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { euro } from "@/lib/team-stats";
import { TaskStrip } from "@/components/TaskStrip";

export const dynamic = "force-dynamic";

/**
 * De klantenlijst.
 *
 * `Customer` bestaat al sinds de eerste verkoop ooit — `markLeadWon` maakt er
 * één aan bij elke gewonnen lead — maar tot nu toe leest niets dit record ooit
 * terug. Dit is het eerste scherm dat het toont.
 */
export default async function KlantenPage() {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);

  const customers = await prisma.customer.findMany({
    where: { kind: "BUYER" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      city: true,
      phone: true,
      createdAt: true,
      deals: {
        where: { wonAt: { not: null } },
        select: { wonValue: true, wonAt: true },
      },
    },
  });

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">Klanten</p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Wie al bij MATO koopt</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Verkoopklanten (gewonnen leads). Huurders in de shop staan onder{" "}
          <Link href="/shop" className="text-[var(--accent)] underline">
            Shop
          </Link>
          .
        </p>
      </div>

      <TaskStrip userId={user.id} />

      {customers.length === 0 ? (
        <section className="panel p-6 space-y-3">
          <div className="label text-[var(--accent)]">Nog niets te zien</div>
          <p className="text-sm text-[var(--text-dim)] max-w-prose">
            Zodra een lead in Verkoop op &ldquo;Verkocht&rdquo; gezet wordt, verschijnt de
            klant hier.
          </p>
        </section>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Klant</th>
                <th>Plaats</th>
                <th>Telefoon</th>
                <th>Klant sinds</th>
                <th>Omzet</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const revenue = c.deals.reduce((sum, d) => sum + (d.wonValue ?? 0), 0);
                const since = c.deals
                  .map((d) => d.wonAt)
                  .filter((d): d is Date => d !== null)
                  .sort((a, b) => a.getTime() - b.getTime())[0];
                return (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/klanten/${c.id}`}
                        className="font-medium hover:text-[var(--accent)]"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="text-sm">{c.city ?? "—"}</td>
                    <td className="mono text-xs">
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="text-[var(--accent)]">
                          {c.phone}
                        </a>
                      ) : (
                        <span className="text-[var(--text-mute)]">—</span>
                      )}
                    </td>
                    <td className="text-sm">
                      {(since ?? c.createdAt).toLocaleDateString("nl-BE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="text-sm">{revenue > 0 ? euro(revenue) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
