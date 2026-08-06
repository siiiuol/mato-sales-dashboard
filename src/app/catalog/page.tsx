import { prisma } from "@/lib/db";
import { upsertProduct } from "@/lib/actions";
import { formatEUR, PRODUCT_LINES } from "@/lib/constants";
import { requirePageUser } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const products = await prisma.product.findMany({ orderBy: [{ line: "asc" }, { name: "asc" }] });

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">Channel 06</p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Catalog</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Machines · behuizing · packaging · terminals · telemetry
        </p>
      </div>

      <section className="panel p-4">
        <h2 className="label text-[var(--accent)] mb-3">Add product</h2>
        <form action={upsertProduct} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input name="name" className="input" placeholder="Name" required />
          <select name="line" className="select" defaultValue="MACHINE">
            {PRODUCT_LINES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <input name="sku" className="input" placeholder="SKU" />
          <input name="listPrice" type="number" step="0.01" className="input" placeholder="List price EUR" required />
          <input name="cost" type="number" step="0.01" className="input" placeholder="Cost EUR" />
          <input name="specs" className="input" placeholder="Specs" />
          <label className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
            <input type="checkbox" name="recurring" /> Recurring
          </label>
          <button type="submit" className="btn btn-primary">
            Save product
          </button>
        </form>
      </section>

      {PRODUCT_LINES.map((line) => {
        const rows = products.filter((p) => p.line === line.value);
        return (
          <section key={line.value} className="panel overflow-x-auto">
            <div className="px-4 pt-4 label text-[var(--accent)]">{line.label}</div>
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Specs</th>
                  <th>Price</th>
                  <th>Cost</th>
                  <th>Margin</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-[var(--text-dim)]">
                      No products
                    </td>
                  </tr>
                )}
                {rows.map((p) => {
                  const margin = p.listPrice - p.cost;
                  return (
                    <tr key={p.id}>
                      <td className="mono text-xs">{p.sku ?? "—"}</td>
                      <td>
                        <div className="font-medium">{p.name}</div>
                        {p.recurring && <span className="badge">recurring</span>}
                      </td>
                      <td className="text-sm text-[var(--text-dim)]">{p.specs ?? "—"}</td>
                      <td className="mono">{formatEUR(p.listPrice)}</td>
                      <td className="mono text-[var(--text-dim)]">{formatEUR(p.cost)}</td>
                      <td className="score">{formatEUR(margin)}</td>
                      <td>
                        {!p.active && <span className="badge">inactive</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
