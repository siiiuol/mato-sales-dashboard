"use client";

import { useMemo } from "react";
import { fillTemplate, type DocumentContext } from "@/lib/documents";
import { DocumentBody } from "@/components/DocumentBody";

/**
 * Live ingevulde documentpreview (CRM-markdown look, geen PDF-engine).
 */
export function DocumentLivePreview({
  templateBody,
  context,
  title = "Voorbeeld",
}: {
  templateBody: string;
  context: DocumentContext;
  title?: string;
}) {
  const filled = useMemo(
    () => fillTemplate(templateBody, context),
    [templateBody, context]
  );

  return (
    <div className="space-y-2 anim-preview" key={filled.slice(0, 80)}>
      <p className="label text-[var(--accent)]">{title}</p>
      <section className="panel p-4 sm:p-6 doc-sheet max-h-[36rem] overflow-y-auto">
        <article className="doc-body text-sm">
          <DocumentBody source={filled} />
        </article>
      </section>
      <p className="text-xs text-[var(--text-dim)]">
        Open velden blijven zichtbaar als {"{{plaats houder}}"} tot u ze invult.
        Definitief bewaren doet u met de knop onder het formulier.
      </p>
    </div>
  );
}
