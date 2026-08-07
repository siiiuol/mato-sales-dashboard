import { prisma } from "@/lib/db";
import { logCall } from "@/lib/actions";
import { CALL_OUTCOMES, statusLabel } from "@/lib/constants";
import { requirePageUser } from "@/lib/dal";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; queue?: string }>;
}) {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const params = await searchParams;
  const selected = params.lead;
  const showQueue = params.queue === "1";
  const now = new Date();
  const leads = await prisma.lead.findMany({
    where: {
      status: {
        in: ["NEW", "TO_CALL", "FOLLOW_UP", "CONTACTED", "NEGOTIATION"],
      },
      doNotContact: false,
      complianceStatus: "CLEARED",
    },
    orderBy: [
      // Zaken met een automaat eerst — bewezen kopers, zoals in Werk.
      { hasVending: "desc" },
      { score: "desc" },
      { timingScore: "desc" },
      { distanceKm: "asc" },
      { lastTouchedAt: "asc" },
      { nextActionAt: "asc" },
    ],
    take: 40,
  });

  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  let pitches: Record<string, string> = {};
  try {
    pitches = JSON.parse(settings?.pitchTemplates ?? "{}");
  } catch {
    pitches = {};
  }

  const due = leads.filter(
    (l) =>
      !l.nextActionAt ||
      l.nextActionAt <= now ||
      l.status === "NEW" ||
      l.status === "TO_CALL"
  );

  const current = leads.find((lead) => lead.id === selected) ?? due[0] ?? leads[0];
  const currentIndex = current ? due.findIndex((lead) => lead.id === current.id) : -1;
  const nextLead = due[currentIndex + 1] ?? due.find((lead) => lead.id !== current?.id);
  const discovery = current?.discoveryQuestions
    ? safeStringArray(current.discoveryQuestions)
    : [];

  return (
    <div className="space-y-5 anim-lock">
      <div className="mission-strip">
        <span>
          Klaar <strong>{due.length}</strong>
        </span>
        <span className="ml-auto">
          <Link href="/" className="text-[var(--accent)]">
            Werk
          </Link>
        </span>
      </div>

      <div>
        <p className="label">Bellen</p>
        <h1 className="display text-3xl font-semibold mt-1">Bellen vandaag</h1>
      </div>

      {current ? (
        <section className="panel p-5 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <p className="label">Je belt</p>
            <h2 className="display text-3xl font-semibold">{current.name}</h2>
            <p className="text-sm text-[var(--text-dim)]">
              {[current.address, current.city, current.province].filter(Boolean).join(" · ")}
            </p>
          </div>

          {current.phone ? (
            <a href={`tel:${current.phone}`} className="dial-orb">
              <div className="text-center px-4">
                <div className="label mb-2">Bellen</div>
                <div className="display text-xl font-semibold">{current.phone}</div>
              </div>
            </a>
          ) : (
            <div className="dial-orb opacity-50">
              <span className="label">Geen nummer</span>
            </div>
          )}

          <div className="grid gap-3 max-w-2xl mx-auto w-full">
            <Block
              label="Openingszin"
              value={current.phoneOpener || pitches.MACHINE || "Stel MATO voor en vraag naar onbemande verkoop."}
            />
            <Block label="Invalshoek" value={current.recommendedAngle} />
            <Block label="Automaat" value={current.recommendedMachine} />
            <div className="border border-[var(--border)] p-3">
              <div className="label mb-2">Wat je vraagt</div>
              <ul className="text-sm space-y-1 text-[var(--text-dim)]">
                {(discovery.length
                  ? discovery
                  : [
                      "Welke producten wilt u onbemand beschikbaar maken?",
                      "Hoe ziet restocking er praktisch uit?",
                      "Denkt u eerder aan aankoop of huur?",
                    ]
                ).map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
            <Block label="Verwacht bezwaar" value={current.likelyObjection} />
          </div>

          <form action={logCall} className="max-w-2xl mx-auto w-full grid gap-3">
            <input type="hidden" name="leadId" value={current.id} />
            <input type="hidden" name="nextLeadId" value={nextLead?.id || ""} />
            <div className="grid grid-cols-2 gap-2">
              {CALL_OUTCOMES.filter((o) =>
                ["NO_ANSWER", "CALLBACK", "INTERESTED", "NOT_INTERESTED"].includes(o.value)
              ).map((o) => (
                <label
                  key={o.value}
                  className="btn btn-ghost cursor-pointer has-[:checked]:border-[var(--accent)] has-[:checked]:text-[var(--accent)] has-[:checked]:bg-[var(--gold-wash)]"
                >
                  <input
                    type="radio"
                    name="outcome"
                    value={o.value}
                    required
                    className="sr-only"
                    defaultChecked={o.value === "NO_ANSWER"}
                  />
                  {o.label}
                </label>
              ))}
            </div>
            <details className="text-sm">
              <summary className="label cursor-pointer">Meer resultaten</summary>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {CALL_OUTCOMES.filter((o) =>
                  ["VOICEMAIL", "WRONG_NUMBER"].includes(o.value)
                ).map((o) => (
                  <label key={o.value} className="btn btn-ghost cursor-pointer has-[:checked]:border-[var(--accent)]">
                    <input type="radio" name="outcome" value={o.value} className="sr-only" />
                    {o.label}
                  </label>
                ))}
              </div>
            </details>
            <input type="datetime-local" name="callbackAt" className="input" />
            <input name="note" className="input" placeholder="Notitie (optioneel)" />
            <button type="submit" className="btn btn-primary btn-xl w-full">
              Noteren en volgende
            </button>
          </form>
        </section>
      ) : (
        <section className="panel p-8 text-center text-[var(--text-dim)]">
          Nog niets klaar om te bellen. Selecteer eerst enkele leads.
        </section>
      )}

      <div>
        <Link href={showQueue ? "/calls" : "/calls?queue=1"} className="btn btn-ghost">
          {showQueue ? "Wachtrij verbergen" : "Wachtrij"}
        </Link>
      </div>

      {showQueue && (
        <section className="panel overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Telefoon</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/calls?lead=${l.id}`} className="hover:text-[var(--accent)]">
                      {l.name}
                    </Link>
                  </td>
                  <td className="mono text-sm">{l.phone ?? "—"}</td>
                  <td>
                    <span className="badge">{statusLabel(l.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function safeStringArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function Block({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border border-[var(--border)] p-3">
      <div className="label mb-2">{label}</div>
      <p className="text-sm text-[var(--text-dim)]">{value || "Niet ingevuld"}</p>
    </div>
  );
}
