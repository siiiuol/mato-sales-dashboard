import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { createCampaign, createCreativeRequest, updateCampaignResults } from "@/lib/marketing-actions";
import {
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_STATUSES,
  CREATIVE_OPEN_STATUSES,
  CREATIVE_TYPES,
  formatEUR,
  MARKETING_CHANNELS,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const now = new Date();

  const [requests, campaigns, assets, users, customers, products, deals] =
    await Promise.all([
      prisma.creativeRequest.findMany({
        orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
        include: {
          campaign: { select: { name: true } },
          customer: { select: { name: true } },
          assignedTo: { select: { name: true } },
          _count: { select: { versions: true } },
        },
      }),
      prisma.campaign.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.brandAsset.count(),
      prisma.user.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.product.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.deal.findMany({
        where: { stage: { notIn: ["WON", "LOST"] } },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true },
      }),
    ]);

  const open = requests.filter((r) =>
    CREATIVE_OPEN_STATUSES.includes(r.status as (typeof CREATIVE_OPEN_STATUSES)[number])
  );
  const awaitingApproval = requests.filter((r) =>
    ["INTERNAL_REVIEW", "CUSTOMER_REVIEW"].includes(r.status)
  );
  const overdue = open.filter((r) => r.deadline && r.deadline < now);
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leadsGenerated, 0);
  const costPerLead = totalLeads > 0 ? totalSpend / totalLeads : null;

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Channel 15</p>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Marketing</h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Creative requests · campaigns · brand library
          </p>
        </div>
        <Link href="/marketing/brand" className="btn">
          Brand library ({assets}) →
        </Link>
      </div>

      <div className="mission-strip">
        <span>
          Open requests <strong>{open.length}</strong>
        </span>
        <span className={awaitingApproval.length > 0 ? "text-[var(--warn)]" : undefined}>
          Awaiting approval <strong>{awaitingApproval.length}</strong>
        </span>
        <span className={overdue.length > 0 ? "text-[var(--warn)]" : undefined}>
          Overdue <strong>{overdue.length}</strong>
        </span>
        <span>
          Active campaigns <strong>{activeCampaigns.length}</strong>
        </span>
        <span>
          Ad spend <strong>{formatEUR(totalSpend)}</strong>
        </span>
        <span className="ml-auto">
          Cost / lead <strong>{costPerLead == null ? "—" : formatEUR(costPerLead)}</strong>
        </span>
      </div>

      <details className="panel p-4">
        <summary className="label text-[var(--accent)] cursor-pointer">
          + New creative request
        </summary>
        <form action={createCreativeRequest} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 sm:col-span-2">
            <span className="label">What do you need? *</span>
            <input className="input" name="title" required maxLength={300} placeholder="Customer mock-up for Bakkerij Dult" />
          </label>
          <label className="space-y-1">
            <span className="label">Type</span>
            <select className="select" name="type" defaultValue="SOCIAL_POST">
              {CREATIVE_TYPES.map((t) => (
                <option key={t} value={t}>{t.replaceAll("_", " ").toLowerCase()}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Deadline</span>
            <input className="input" name="deadline" type="date" />
          </label>
          <label className="space-y-1">
            <span className="label">Priority</span>
            <select className="select" name="priority" defaultValue="NORMAL">
              {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Assign to</span>
            <select className="select" name="assignedToId" defaultValue="">
              <option value="">— unassigned —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Campaign</span>
            <select className="select" name="campaignId" defaultValue="">
              <option value="">—</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Customer</span>
            <select className="select" name="customerId" defaultValue="">
              <option value="">—</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Product</span>
            <select className="select" name="productId" defaultValue="">
              <option value="">—</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Linked deal</span>
            <select className="select" name="dealId" defaultValue="">
              <option value="">—</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Platform</span>
            <select className="select" name="platform" defaultValue="">
              <option value="">—</option>
              {MARKETING_CHANNELS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Dimensions</span>
            <input className="input" name="dimensions" maxLength={100} placeholder="1080×1350" />
          </label>
          <label className="space-y-1">
            <span className="label">Language</span>
            <select className="select" name="language" defaultValue="nl">
              {["nl", "fr", "en"].map((l) => (
                <option key={l} value={l}>{l.toUpperCase()}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="label">Main message</span>
            <input className="input" name="mainMessage" maxLength={1000} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="label">Call to action</span>
            <input className="input" name="cta" maxLength={200} />
          </label>
          <label className="space-y-1 sm:col-span-2 lg:col-span-4">
            <span className="label">Brief / objective</span>
            <textarea className="textarea" name="objective" maxLength={1000} />
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <button className="btn btn-primary" type="submit">Submit request</button>
          </div>
        </form>
      </details>

      <section className="panel overflow-x-auto">
        <div className="p-4 pb-0">
          <h2 className="label text-[var(--accent)]">Creative requests</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Request</th>
              <th>Type</th>
              <th>Owner</th>
              <th>Deadline</th>
              <th>Versions</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="text-[var(--text-dim)]">
                  No creative requests yet. Sales can raise one from here.
                </td>
              </tr>
            )}
            {requests.map((r) => {
              const isOverdue =
                r.deadline &&
                r.deadline < now &&
                CREATIVE_OPEN_STATUSES.includes(r.status as (typeof CREATIVE_OPEN_STATUSES)[number]);
              return (
                <tr key={r.id}>
                  <td className="mono text-xs">
                    <Link href={`/marketing/creatives/${r.id}`} className="hover:text-[var(--accent)]">
                      {r.code}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/marketing/creatives/${r.id}`} className="hover:text-[var(--accent)] font-medium">
                      {r.title}
                    </Link>
                    <div className="text-xs text-[var(--text-dim)]">
                      {r.campaign?.name ?? r.customer?.name ?? "—"}
                    </div>
                  </td>
                  <td className="text-xs">{r.type.replaceAll("_", " ").toLowerCase()}</td>
                  <td className="text-sm">{r.assignedTo?.name ?? "—"}</td>
                  <td className={`mono text-xs ${isOverdue ? "text-[var(--warn)]" : ""}`}>
                    {r.deadline ? r.deadline.toLocaleDateString("nl-BE") : "—"}
                  </td>
                  <td className="mono">{r._count.versions}</td>
                  <td>
                    <span className={`badge ${r.status === "APPROVED" ? "badge-live" : ""}`}>
                      {r.status.replaceAll("_", " ")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <details className="panel p-4">
        <summary className="label text-[var(--accent)] cursor-pointer">+ New campaign</summary>
        <form action={createCampaign} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 sm:col-span-2">
            <span className="label">Campaign name *</span>
            <input className="input" name="name" required maxLength={300} />
          </label>
          <label className="space-y-1">
            <span className="label">Objective</span>
            <select className="select" name="objective" defaultValue="LEAD_GENERATION">
              {CAMPAIGN_OBJECTIVES.map((o) => (
                <option key={o} value={o}>{o.replaceAll("_", " ").toLowerCase()}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Budget (EUR)</span>
            <input className="input" name="budget" type="number" step="0.01" min={0} />
          </label>
          <label className="space-y-1">
            <span className="label">Start</span>
            <input className="input" name="startAt" type="date" />
          </label>
          <label className="space-y-1">
            <span className="label">End</span>
            <input className="input" name="endAt" type="date" />
          </label>
          <label className="space-y-1">
            <span className="label">Channels</span>
            <input className="input" name="channels" maxLength={300} placeholder="LINKEDIN, EMAIL" />
          </label>
          <label className="space-y-1">
            <span className="label">Landing page</span>
            <input className="input" name="landingPage" maxLength={2048} />
          </label>
          <label className="space-y-1 sm:col-span-2 lg:col-span-4">
            <span className="label">Target audience</span>
            <input className="input" name="audience" maxLength={500} />
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <button className="btn btn-primary" type="submit">Create campaign</button>
          </div>
        </form>
      </details>

      <section className="panel overflow-x-auto">
        <div className="p-4 pb-0">
          <h2 className="label text-[var(--accent)]">Campaigns · results</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Objective</th>
              <th>Budget</th>
              <th>Spend</th>
              <th>Leads</th>
              <th>Cost / lead</th>
              <th>Status · update</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={7} className="text-[var(--text-dim)]">
                  No campaigns yet.
                </td>
              </tr>
            )}
            {campaigns.map((c) => {
              const cpl = c.leadsGenerated > 0 ? c.spend / c.leadsGenerated : null;
              return (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td className="text-xs">{c.objective.replaceAll("_", " ").toLowerCase()}</td>
                  <td className="mono">{formatEUR(c.budget)}</td>
                  <td className="mono">{formatEUR(c.spend)}</td>
                  <td className="mono">{c.leadsGenerated}</td>
                  <td className="score">{cpl == null ? "—" : formatEUR(cpl)}</td>
                  <td>
                    <form action={updateCampaignResults} className="flex flex-wrap items-center gap-1">
                      <input type="hidden" name="campaignId" value={c.id} />
                      <select className="select w-auto py-1 min-h-0 text-xs" name="status" defaultValue={c.status}>
                        {CAMPAIGN_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <input
                        className="input w-20 py-1 min-h-0 text-xs"
                        name="spend"
                        type="number"
                        step="0.01"
                        min={0}
                        defaultValue={c.spend}
                        aria-label="Spend"
                      />
                      <input
                        className="input w-16 py-1 min-h-0 text-xs"
                        name="leadsGenerated"
                        type="number"
                        min={0}
                        defaultValue={c.leadsGenerated}
                        aria-label="Leads"
                      />
                      <button className="btn py-1 min-h-0" type="submit">Save</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
