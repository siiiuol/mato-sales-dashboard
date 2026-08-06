import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { idSchema } from "@/lib/validation";
import { formatEUR } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function QuotePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const quote = await prisma.quote.findUnique({
    where: { id: id.data },
    include: { lines: true, lead: true, customer: true, deal: true },
  });
  if (!quote) notFound();
  const subtotal = quote.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
  const total = subtotal * (1 - quote.discountPercent / 100);

  return (
    <article className="panel p-8 max-w-4xl mx-auto bg-white text-black print:border-0">
      <header className="flex justify-between gap-6 border-b border-black pb-6">
        <div><div className="font-bold text-3xl">MATO</div><p>Vending equipment & telemetry</p></div>
        <div className="text-right">
          <h1 className="text-3xl font-semibold">Quote {quote.number}</h1>
          <p>Status: {quote.status}</p>
          <p>Valid until: {quote.validUntil?.toLocaleDateString("nl-BE") || "on review"}</p>
        </div>
      </header>
      <section className="py-6">
        <h2 className="font-semibold">For</h2>
        <p>{quote.customer?.name || quote.lead?.name || quote.deal?.title || "Prospect"}</p>
      </section>
      <table className="w-full border-collapse">
        <thead><tr className="border-b border-black"><th className="text-left py-2">Description</th><th>Qty</th><th className="text-right">Unit</th><th className="text-right">Total</th></tr></thead>
        <tbody>
          {quote.lines.map((line) => (
            <tr key={line.id} className="border-b border-gray-300">
              <td className="py-3">{line.description}<div className="text-xs">{line.sku}</div></td>
              <td className="text-center">{line.qty}</td>
              <td className="text-right">{formatEUR(line.unitPrice)}</td>
              <td className="text-right">{formatEUR(line.qty * line.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto mt-6 max-w-xs space-y-1">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatEUR(subtotal)}</span></div>
        <div className="flex justify-between"><span>Discount</span><span>{quote.discountPercent}%</span></div>
        <div className="flex justify-between text-xl font-bold border-t border-black pt-2"><span>Total</span><span>{formatEUR(total)}</span></div>
      </div>
      {quote.notes && <p className="mt-8 whitespace-pre-wrap">{quote.notes}</p>}
      <p className="mt-12 text-xs">Prepared for human approval. This print view is not an electronic invoice.</p>
    </article>
  );
}
