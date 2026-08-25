import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { markDocumentSigned } from "@/lib/document-actions";
import { idSchema } from "@/lib/validation";
import { DocumentBody } from "@/components/DocumentBody";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  READY: "Klaar om te versturen",
  SENT: "Verstuurd",
  SIGNED: "Getekend",
};

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();

  const document = await prisma.generatedDocument.findUnique({
    where: { id: parsed.data },
    include: {
      lead: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!document) notFound();

  let missing: string[] = [];
  try {
    missing = JSON.parse(document.validationJson ?? "{}").missing ?? [];
  } catch {
    missing = [];
  }

  return (
    <div className="space-y-5 anim-lock">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 doc-hide">
        <div>
          <p className="label">Document · {document.templateCode}</p>
          <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
            {document.title}
          </h1>
          <p className="mono text-sm text-[var(--text-dim)] mt-1">
            {document.number}
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            <span className="badge">
              {STATUS_LABELS[document.status] ?? document.status}
            </span>
            {document.createdBy && (
              <span className="badge">Opgemaakt door {document.createdBy.name}</span>
            )}
            {document.signedAt && (
              <span className="badge badge-live">
                Getekend door {document.signerName}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {document.lead && (
            <Link href={`/leads/${document.lead.id}`} className="btn">
              Naar de lead
            </Link>
          )}
          <Link href="/" className="btn btn-ghost">
            Mijn leads
          </Link>
        </div>
      </div>

      {missing.length > 0 && (
        <section
          className="panel p-4 doc-hide"
          style={{ borderColor: "var(--alert)" }}
        >
          <div className="label" style={{ color: "var(--alert)" }}>
            Nog niet compleet
          </div>
          <p className="text-sm mt-1">
            Deze velden staan nog open en zijn in de tekst zichtbaar als{" "}
            <code className="mono">{"{{veld}}"}</code>:{" "}
            <strong>{missing.join(", ")}</strong>.
          </p>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Vul ze aan bij de lead of in het sjabloon en maak het document
            opnieuw. Zo gaat er nooit een contract de deur uit met een leeg veld
            dat niemand opmerkt.
          </p>
        </section>
      )}

      <section className="panel p-6 sm:p-10 doc-sheet">
        <article className="doc-body">
          <DocumentBody source={document.body} />
        </article>
      </section>

      <div className="flex flex-wrap gap-3 items-end doc-hide">
        <p className="text-sm text-[var(--text-dim)]">
          Afdrukken of als pdf bewaren met <kbd className="mono">Ctrl</kbd>/
          <kbd className="mono">Cmd</kbd> + <kbd className="mono">P</kbd> — de
          knoppen en de navigatie vallen dan vanzelf weg.
        </p>
        {document.status !== "SIGNED" && (
          <form action={markDocumentSigned} className="flex flex-wrap gap-2 items-end">
            <input type="hidden" name="documentId" value={document.id} />
            <div>
              <label className="label block mb-1">Getekend door</label>
              <input
                name="signerName"
                className="input"
                placeholder="Naam van de klant"
                required
                minLength={2}
              />
            </div>
            <button className="btn btn-primary">Als getekend noteren</button>
          </form>
        )}
      </div>
    </div>
  );
}
