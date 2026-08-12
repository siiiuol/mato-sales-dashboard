import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { markDocumentSigned } from "@/lib/document-actions";
import { idSchema } from "@/lib/validation";

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
          {renderMarkdown(document.body)}
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

/**
 * Zet de sjabloontekst om naar HTML.
 *
 * Bewust een kleine eigen omzetter en geen markdown-bibliotheek: het sjabloon
 * is van ons, gebruikt maar een handvol constructies, en alles wat er uit de
 * database in komt wordt door React als tekst weergegeven en dus niet als HTML
 * uitgevoerd.
 */
function renderMarkdown(source: string) {
  const blocks: React.ReactNode[] = [];
  const lines = source.split("\n");
  let table: string[][] = [];
  let paragraph: string[] = [];

  const flushParagraph = (key: string) => {
    if (!paragraph.length) return;
    blocks.push(
      <p key={key} className="mb-3 leading-relaxed">
        {inline(paragraph.join(" "))}
      </p>
    );
    paragraph = [];
  };

  const flushTable = (key: string) => {
    if (!table.length) return;
    const rows = table.filter(
      (cells) => !cells.every((c) => /^-{2,}$/.test(c.trim()) || c.trim() === "")
    );
    blocks.push(
      <table key={key} className="table mb-4">
        <tbody>
          {rows.map((cells, rowIndex) => (
            <tr key={rowIndex}>
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex}>{inline(cell.trim())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
    table = [];
  };

  lines.forEach((line, index) => {
    const key = `b${index}`;
    if (line.trim().startsWith("|")) {
      flushParagraph(key);
      table.push(line.split("|").slice(1, -1));
      return;
    }
    flushTable(key);

    if (!line.trim()) {
      flushParagraph(key);
      return;
    }
    if (line.startsWith("## ")) {
      flushParagraph(key);
      blocks.push(
        <h2 key={key} className="display text-lg font-semibold mt-6 mb-2">
          {line.slice(3)}
        </h2>
      );
      return;
    }
    if (line.startsWith("# ")) {
      flushParagraph(key);
      blocks.push(
        <h1 key={key} className="display text-2xl font-semibold mb-4">
          {line.slice(2)}
        </h1>
      );
      return;
    }
    paragraph.push(line);
  });

  flushParagraph("last-p");
  flushTable("last-t");
  return blocks;
}

/** Alleen **vet** en *cursief*; meer heeft het sjabloon niet nodig. */
function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <span key={index}>{part}</span>;
  });
}
