import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { formatCatalogPrice, MATO_CATALOG_GUIDE } from "@/lib/mato-catalog";
import { PRODUCT_LINES } from "@/lib/constants";
import { ProductImageForm } from "@/components/ProductImageForm";

export const dynamic = "force-dynamic";

function lineLabel(line: string) {
  return PRODUCT_LINES.find((l) => l.value === line)?.label ?? line;
}

/**
 * Leesbare productcatalogus — zelfde bron als mail/Assistent (matoautomaat.be).
 */
export default async function ProductenPage() {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ line: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6 anim-lock max-w-4xl">
      <div>
        <p className="label">
          <Link href="/settings" className="hover:text-[var(--accent)]">
            Instellingen
          </Link>
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Producten</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Catalogus zoals op{" "}
          <a
            href="https://www.matoautomaat.be"
            className="text-[var(--accent)] underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            matoautomaat.be
          </a>
          . Een productfoto verschijnt klein op koopcontract en factuurpreview.
        </p>
      </div>

      <section className="panel p-4 text-sm text-[var(--text-dim)] whitespace-pre-line">
        {MATO_CATALOG_GUIDE}
      </section>

      {products.length === 0 ? (
        <p className="text-sm text-[var(--text-dim)]">
          Nog geen producten. Draai{" "}
          <span className="mono">npx tsx scripts/sync-mato-catalog.ts</span>.
        </p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Lijn</th>
                <th>Prijs</th>
                <th>SKU</th>
                {user.role === "admin" ? <th>Foto</th> : null}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="font-medium">{p.name}</div>
                    {p.description ? (
                      <p className="text-xs text-[var(--text-dim)] mt-0.5 max-w-md">
                        {p.description}
                      </p>
                    ) : null}
                  </td>
                  <td>{lineLabel(p.line)}</td>
                  <td className="text-sm">{formatCatalogPrice(p.listPrice)}</td>
                  <td className="mono text-xs">{p.sku ?? "—"}</td>
                  {user.role === "admin" ? (
                    <td>
                      <ProductImageForm
                        productId={p.id}
                        imageUrl={p.imageUrl}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
