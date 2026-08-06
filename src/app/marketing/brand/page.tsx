import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { createBrandAsset, setAssetStatus } from "@/lib/marketing-actions";
import { ASSET_STATUSES, BRAND_ASSET_TYPES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function BrandLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const typeFilter = (await searchParams).type ?? null;
  const now = new Date();

  const [assets, campaigns, products, typeCounts] = await Promise.all([
    prisma.brandAsset.findMany({
      where: typeFilter ? { type: typeFilter } : {},
      orderBy: { updatedAt: "desc" },
      include: {
        campaign: { select: { name: true } },
        product: { select: { name: true } },
        owner: { select: { name: true } },
      },
    }),
    prisma.campaign.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.brandAsset.groupBy({ by: ["type"], _count: true }),
  ]);

  const expiring = assets.filter(
    (a) => a.expiresAt && a.expiresAt > now && a.expiresAt < new Date(now.getTime() + 30 * 86400000)
  );
  const expired = assets.filter((a) => a.expiresAt && a.expiresAt <= now);

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">
            <Link href="/marketing" className="hover:text-[var(--accent)]">Marketing</Link> · brand
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Brand library</h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Approved logos, renders, photos and copy · one source of truth
          </p>
        </div>
      </div>

      <div className="mission-strip">
        <span>Assets <strong>{assets.length}</strong></span>
        <span>
          Approved <strong>{assets.filter((a) => a.status === "APPROVED").length}</strong>
        </span>
        <span className={expiring.length > 0 ? "text-[var(--warn)]" : undefined}>
          Expiring &lt; 30d <strong>{expiring.length}</strong>
        </span>
        <span className={expired.length > 0 ? "text-[var(--danger)]" : undefined}>
          Expired <strong>{expired.length}</strong>
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/marketing/brand" className={`badge ${!typeFilter ? "badge-live" : ""}`}>
          all
        </Link>
        {typeCounts.map((t) => (
          <Link
            key={t.type}
            href={`/marketing/brand?type=${t.type}`}
            className={`badge ${typeFilter === t.type ? "badge-live" : ""}`}
          >
            {t.type.replaceAll("_", " ").toLowerCase()} · {t._count}
          </Link>
        ))}
      </div>

      <details className="panel p-4">
        <summary className="label text-[var(--accent)] cursor-pointer">+ Add asset</summary>
        <form action={createBrandAsset} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 sm:col-span-2">
            <span className="label">Asset name *</span>
            <input className="input" name="name" required maxLength={300} />
          </label>
          <label className="space-y-1">
            <span className="label">Type</span>
            <select className="select" name="type" defaultValue="MACHINE_IMAGE">
              {BRAND_ASSET_TYPES.map((t) => (
                <option key={t} value={t}>{t.replaceAll("_", " ").toLowerCase()}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">File link</span>
            <input className="input" name="fileUrl" maxLength={2048} placeholder="https://…" />
          </label>
          <label className="space-y-1">
            <span className="label">Format</span>
            <input className="input" name="fileFormat" maxLength={20} placeholder="PNG / MP4 / PDF" />
          </label>
          <label className="space-y-1">
            <span className="label">Dimensions</span>
            <input className="input" name="dimensions" maxLength={100} />
          </label>
          <label className="space-y-1">
            <span className="label">Language</span>
            <select className="select" name="language" defaultValue="">
              <option value="">— any —</option>
              {["nl", "fr", "en"].map((l) => (
                <option key={l} value={l}>{l.toUpperCase()}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Expires</span>
            <input className="input" name="expiresAt" type="date" />
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
            <span className="label">Product</span>
            <select className="select" name="productId" defaultValue="">
              <option value="">—</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Usage rights</span>
            <input className="input" name="usageRights" maxLength={500} placeholder="Owned · licensed until…" />
          </label>
          <label className="space-y-1">
            <span className="label">Tags</span>
            <input className="input" name="tags" maxLength={500} />
          </label>
          <label className="space-y-1 sm:col-span-2 lg:col-span-4">
            <span className="label">Description</span>
            <textarea className="textarea" name="description" maxLength={2000} />
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <button className="btn btn-primary" type="submit">Add asset</button>
          </div>
        </form>
      </details>

      {assets.length === 0 ? (
        <section className="panel p-6 text-[var(--text-dim)]">
          {typeFilter
            ? "No assets of this type."
            : "Brand library is empty. Add your logo, machine photos and approved copy so nobody rebuilds them from scratch."}
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => {
            const isExpired = a.expiresAt && a.expiresAt <= now;
            return (
              <article key={a.id} className="panel p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-medium truncate">{a.name}</h2>
                    <p className="text-xs text-[var(--text-dim)]">
                      {a.type.replaceAll("_", " ").toLowerCase()}
                      {a.fileFormat ? ` · ${a.fileFormat}` : ""}
                      {a.dimensions ? ` · ${a.dimensions}` : ""}
                    </p>
                  </div>
                  <span
                    className={`badge shrink-0 ${
                      isExpired
                        ? "text-[var(--danger)] border-[var(--danger)]"
                        : a.status === "APPROVED"
                          ? "badge-live"
                          : ""
                    }`}
                  >
                    {isExpired ? "EXPIRED" : a.status}
                  </span>
                </div>
                {a.description && (
                  <p className="text-sm text-[var(--text-dim)]">{a.description}</p>
                )}
                <div className="text-xs text-[var(--text-dim)] space-y-1">
                  {a.campaign && <div>campaign: {a.campaign.name}</div>}
                  {a.product && <div>product: {a.product.name}</div>}
                  {a.usageRights && <div>rights: {a.usageRights}</div>}
                  {a.expiresAt && (
                    <div className={isExpired ? "text-[var(--danger)]" : undefined}>
                      expires {a.expiresAt.toLocaleDateString("nl-BE")}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  {a.fileUrl ? (
                    <a href={a.fileUrl} target="_blank" rel="noreferrer" className="btn py-1 min-h-0">
                      Open
                    </a>
                  ) : (
                    <span className="badge">no file link</span>
                  )}
                  <form action={setAssetStatus} className="flex items-center gap-1">
                    <input type="hidden" name="assetId" value={a.id} />
                    <select className="select w-auto py-1 min-h-0 text-xs" name="status" defaultValue={a.status}>
                      {ASSET_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button className="btn py-1 min-h-0" type="submit">Set</button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
