import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Print view follows the MATO document aesthetic (spec §36): white background,
 * matte-black type, fixed header and footer, legal identifiers in the footer
 * rather than typed into each template.
 */
export default async function DocumentPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();

  const [doc, settings] = await Promise.all([
    prisma.generatedDocument.findUnique({
      where: { id: parsed.data },
      include: {
        customer: { select: { name: true, address: true, city: true } },
        supplier: { select: { name: true, country: true } },
        lead: { select: { name: true, city: true } },
        clauses: { orderBy: { orderIndex: "asc" } },
      },
    }),
    prisma.appSettings.findUnique({ where: { id: "default" } }),
  ]);
  if (!doc) notFound();

  const party = doc.customer ?? doc.supplier ?? doc.lead ?? null;
  const partyLines = doc.customer
    ? [doc.customer.name, doc.customer.address, doc.customer.city]
    : doc.supplier
      ? [doc.supplier.name, doc.supplier.country]
      : doc.lead
        ? [doc.lead.name, doc.lead.city]
        : [];

  return (
    <article className="panel p-10 max-w-4xl mx-auto bg-white text-black print:border-0 print:p-0">
      <header className="flex justify-between gap-6 border-b-2 border-black pb-6">
        <div>
          <div className="font-bold text-4xl tracking-[0.18em]">MATO</div>
          <p className="text-sm mt-1">Vending equipment · packaging · telemetry</p>
        </div>
        <div className="text-right text-sm">
          <h1 className="text-2xl font-semibold">{doc.title}</h1>
          <p className="font-mono mt-1">{doc.number}</p>
          <p>Status: {doc.status}</p>
          <p>Date: {doc.createdAt.toLocaleDateString("nl-BE")}</p>
          <p className="text-xs text-gray-600 mt-1">
            Template {doc.templateCode} v{doc.templateVersion}
          </p>
        </div>
      </header>

      {party && (
        <section className="py-6 border-b border-gray-300">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-gray-600">For</h2>
          <div className="mt-1">
            {partyLines.filter(Boolean).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </section>
      )}

      <section className="py-6 whitespace-pre-wrap leading-relaxed">{doc.body}</section>

      {doc.clauses.length > 0 && (
        <section className="py-6 border-t border-gray-300 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-gray-600">
            Terms and conditions
          </h2>
          {doc.clauses.map((c) => (
            <div key={c.id}>
              <h3 className="font-semibold text-sm">
                {c.clauseCode}
                <span className="font-normal text-xs text-gray-500"> v{c.clauseVersion}</span>
              </h3>
              <p className="text-sm whitespace-pre-wrap">{c.textSnapshot}</p>
            </div>
          ))}
        </section>
      )}

      {doc.signedAt ? (
        <section className="py-6 border-t border-gray-300 text-sm">
          <p className="font-semibold">Signed</p>
          <p>
            {doc.signerName} · {doc.signedAt.toLocaleDateString("nl-BE")}
          </p>
        </section>
      ) : (
        <section className="py-10 border-t border-gray-300 grid grid-cols-2 gap-10 text-sm">
          <div>
            <div className="border-b border-black h-16" />
            <p className="mt-1">For {settings?.businessName ?? "MATO"}</p>
          </div>
          <div>
            <div className="border-b border-black h-16" />
            <p className="mt-1">For {party?.name ?? "counterparty"}</p>
          </div>
        </section>
      )}

      <footer className="border-t-2 border-black pt-4 mt-6 text-xs text-gray-700 flex justify-between gap-4">
        <span>{settings?.businessName ?? "MATO"}</span>
        <span>{doc.number}</span>
        <span>Confidential — for the addressee only</span>
      </footer>
    </article>
  );
}
