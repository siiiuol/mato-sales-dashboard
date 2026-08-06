import { prisma } from "@/lib/db";
import { dealTotal, formatEUR, PRODUCT_LINES } from "@/lib/constants";
import { requirePageUser } from "@/lib/dal";
import { fetchLearningReport } from "@/lib/learning";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const [won, open, leads, outreach, learning] = await Promise.all([
    prisma.deal.findMany({
      where: { stage: "WON" },
      include: { lines: { include: { product: true } }, lead: true, customer: true },
      orderBy: { wonAt: "desc" },
    }),
    prisma.deal.findMany({
      where: { stage: { notIn: ["WON", "LOST"] } },
      include: { lines: true },
    }),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.outreachEvent.count(),
    fetchLearningReport(),
  ]);

  const wonTotal = won.reduce((s, d) => s + dealTotal(d.lines, d.discountPercent), 0);
  const openTotal = open.reduce((s, d) => s + dealTotal(d.lines, d.discountPercent), 0);

  const byLine = won
    .flatMap((d) => d.lines)
    .reduce(
      (acc, line) => {
        const key = line.product.line;
        acc[key] = (acc[key] ?? 0) + line.qty * line.unitPrice;
        return acc;
      },
      {} as Record<string, number>
    );

  const byProvince = won.reduce(
    (acc, d) => {
      const prov = d.customer?.province ?? d.lead?.province ?? "Unknown";
      acc[prov] = (acc[prov] ?? 0) + dealTotal(d.lines, d.discountPercent);
      return acc;
    },
    {} as Record<string, number>
  );

  const leadCount = leads.reduce((s, x) => s + x._count, 0);
  const wonLeads = leads.find((x) => x.status === "WON")?._count ?? 0;
  const bySource = won.reduce((acc, deal) => {
    const source = deal.lead?.source || "customer/direct";
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const byTier = won.reduce((acc, deal) => {
    const tier = deal.lead?.tier || "unranked";
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const outcome = leads.reduce((acc, row) => {
    acc[row.status] = row._count;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">Channel 07</p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Sales</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Revenue · pipeline · conversion
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Won revenue" value={formatEUR(wonTotal)} />
        <Metric label="Open pipeline" value={formatEUR(openTotal)} />
        <Metric label="Calls logged" value={String(outreach)} />
        <Metric
          label="Lead → won"
          value={leadCount ? `${Math.round((wonLeads / leadCount) * 100)}%` : "—"}
        />
      </div>

      <section className="panel p-4 space-y-4">
        <div>
          <h2 className="label text-[var(--accent)]">Learning operations</h2>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Authoritative rules compared with the non-authoritative shadow baseline
          </p>
        </div>
        {!learning ? (
          <p className="text-sm text-[var(--text-dim)]">Insufficient data — learning service unavailable.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric
                label="Cost / qualified"
                value={learning.cost_per_qualified_lead_eur == null ? "Insufficient data" : formatEUR(learning.cost_per_qualified_lead_eur)}
              />
              <Metric
                label="Cost / approved"
                value={learning.cost_per_approved_lead_eur == null ? "Insufficient data" : formatEUR(learning.cost_per_approved_lead_eur)}
              />
              <Metric
                label="Gross margin / 100 reviewed"
                value={learning.gross_margin_per_100_reviewed_eur == null ? "Insufficient data" : formatEUR(learning.gross_margin_per_100_reviewed_eur)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {["relevance", "response", "meeting", "close"].map((target) => {
                const metric = learning.targets?.[target];
                return (
                  <div key={target} className="border border-[var(--border)] rounded p-3">
                    <div className="label">{target}</div>
                    {!metric || metric.status !== "ok" ? (
                      <p className="text-sm text-[var(--text-dim)] mt-2">
                        Insufficient data ({metric?.sample_count ?? 0} samples)
                      </p>
                    ) : (
                      <div className="text-sm mt-2 space-y-1">
                        <div>Rule MAE <span className="score">{metric.rule_baseline_mae?.toFixed(3) ?? "—"}</span></div>
                        <div>Shadow MAE <span className="score">{metric.mae.toFixed(3)}</span></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric
                label="Approval rate"
                value={
                  learning.approval_rate == null
                    ? "Insufficient data"
                    : `${Math.round(learning.approval_rate * 100)}%`
                }
              />
              <Metric
                label="Meeting rate"
                value={
                  learning.meeting_rate == null
                    ? "Insufficient data"
                    : `${Math.round(learning.meeting_rate * 100)}%`
                }
              />
              <Metric
                label="Rule mean EV"
                value={
                  learning.rule_vs_shadow?.rule_mean_expected_margin_eur == null
                    ? "Insufficient data"
                    : formatEUR(learning.rule_vs_shadow.rule_mean_expected_margin_eur)
                }
              />
            </div>
            <p className="text-xs text-[var(--text-dim)] font-mono tracking-wide">
              PROMOTE-ONLY · candidates never auto-promote ·{" "}
              {learning.rule_vs_shadow?.candidate_rule_versions ?? 0} candidate
              {(learning.rule_vs_shadow?.candidate_rule_versions ?? 0) === 1 ? "" : "s"} ·{" "}
              {learning.rule_vs_shadow?.active_rule_versions ?? 0} active
            </p>
          </>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="label text-[var(--accent)] mb-3">By product line</h2>
          <ul className="space-y-2">
            {PRODUCT_LINES.map((line) => (
              <li key={line.value} className="flex justify-between text-sm">
                <span>{line.label}</span>
                <span className="score">{formatEUR(byLine[line.value] ?? 0)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel p-4">
          <h2 className="label text-[var(--accent)] mb-3">By province</h2>
          <ul className="space-y-2">
            {Object.keys(byProvince).length === 0 && (
              <li className="text-sm text-[var(--text-dim)]">No won deals yet</li>
            )}
            {Object.entries(byProvince)
              .sort((a, b) => b[1] - a[1])
              .map(([prov, value]) => (
                <li key={prov} className="flex justify-between text-sm">
                  <span>{prov}</span>
                  <span className="score">{formatEUR(value)}</span>
                </li>
              ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Breakdown title="Won by source" values={bySource} />
        <Breakdown title="Won by tier" values={byTier} />
        <Breakdown title="Lead outcomes" values={outcome} />
      </div>

      <section className="panel overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Won at</th>
              <th>Deal</th>
              <th>Account</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {won.length === 0 && (
              <tr>
                <td colSpan={4} className="text-[var(--text-dim)]">
                  No closed wins
                </td>
              </tr>
            )}
            {won.map((d) => (
              <tr key={d.id}>
                <td className="mono text-xs">
                  {d.wonAt ? d.wonAt.toLocaleDateString("nl-BE") : "—"}
                </td>
                <td>{d.title}</td>
                <td className="text-sm text-[var(--text-dim)]">
                  {d.customer?.name ?? d.lead?.name ?? "—"}
                </td>
                <td className="score">{formatEUR(dealTotal(d.lines, d.discountPercent))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Breakdown({ title, values }: { title: string; values: Record<string, number> }) {
  return (
    <section className="panel p-4">
      <h2 className="label text-[var(--accent)] mb-3">{title}</h2>
      <ul className="space-y-2 text-sm">
        {Object.entries(values).sort((a, b) => b[1] - a[1]).map(([key, value]) => (
          <li key={key} className="flex justify-between"><span>{key}</span><span className="score">{value}</span></li>
        ))}
      </ul>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <div className="label">{label}</div>
      <div className="text-2xl mono mt-2">{value}</div>
    </div>
  );
}
