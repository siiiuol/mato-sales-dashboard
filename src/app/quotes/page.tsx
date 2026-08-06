import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { deleteQuote, updateQuoteStatus } from "@/lib/actions";
import { formatEUR } from "@/lib/constants";

export const dynamic = "force-dynamic";
const STATUSES = ["DRAFT", "REVIEW", "APPROVED", "SENT", "ACCEPTED", "EXPIRED"];

export default async function QuotesPage() {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const quotes = await prisma.quote.findMany({
    include: { lines: true, lead: true, customer: true, deal: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">Commercial docs</p>
        <h1 className="text-3xl font-semibold mt-1">Quotes</h1>
        <p className="text-sm text-[var(--text-dim)]">Human-reviewed quote snapshots and print views</p>
      </div>
      <section className="panel overflow-x-auto">
        <table className="table">
          <thead><tr><th>Quote</th><th>Account</th><th>Status</th><th>Valid</th><th>Total</th><th>Actions</th></tr></thead>
          <tbody>
            {quotes.map((quote) => {
              const subtotal = quote.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
              const total = subtotal * (1 - quote.discountPercent / 100);
              return (
                <tr key={quote.id}>
                  <td><Link className="font-medium hover:text-[var(--accent)]" href={`/quotes/${quote.id}/print`}>{quote.number}</Link></td>
                  <td>{quote.customer?.name || quote.lead?.name || quote.deal?.title || "—"}</td>
                  <td>
                    <form action={updateQuoteStatus} className="flex gap-1">
                      <input type="hidden" name="quoteId" value={quote.id} />
                      <select name="status" className="select" defaultValue={quote.status}>
                        {STATUSES.map((status) => <option key={status}>{status}</option>)}
                      </select>
                      <button className="btn btn-ghost">Save</button>
                    </form>
                  </td>
                  <td>{quote.validUntil?.toLocaleDateString("nl-BE") || "—"}</td>
                  <td className="score">{formatEUR(total)}</td>
                  <td className="flex gap-1">
                    <Link href={`/quotes/${quote.id}/print`} className="btn btn-ghost">Print</Link>
                    <form action={deleteQuote.bind(null, quote.id)}>
                      <button className="btn btn-danger">Delete</button>
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
