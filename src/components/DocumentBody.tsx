import type { ReactNode } from "react";

/**
 * Zet sjabloon-markdown om naar HTML (zelfde look als de documentpagina).
 *
 * Bewust geen markdown-bibliotheek: handvol constructies, database-tekst als
 * React-tekst (geen HTML-executie). Ondersteunt ook `![alt](url)` voor productfoto's.
 */
export function DocumentBody({ source }: { source: string }) {
  return <>{renderDocumentMarkdown(source)}</>;
}

export function renderDocumentMarkdown(source: string): ReactNode[] {
  const blocks: ReactNode[] = [];
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

    const imgOnly = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (imgOnly) {
      flushParagraph(key);
      blocks.push(
        <p key={key} className="mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgOnly[2]}
            alt={imgOnly[1] || "Product"}
            className="doc-product-img"
          />
        </p>
      );
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

/** **vet**, *cursief* en ![alt](url). */
function inline(text: string): ReactNode {
  const parts = text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*|!\[[^\]]*\]\([^)\s]+\))/g)
    .filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("![") && part.includes("](")) {
      const m = part.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (m) {
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={index}
            src={m[2]}
            alt={m[1] || "Product"}
            className="doc-product-img inline-block align-middle"
          />
        );
      }
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <span key={index}>{part}</span>;
  });
}
