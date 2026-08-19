import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { idSchema } from "@/lib/validation";
import { documentCategoryLabel, templateStatusLabel } from "@/lib/constants";
import {
  updateTemplateDraft,
  createTemplateVersion,
  setTemplateActive,
} from "@/lib/template-actions";
import { TemplateBodyEditor } from "@/components/TemplateBodyEditor";

export const dynamic = "force-dynamic";

export default async function SjabloonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(["admin"]);
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();

  const template = await prisma.documentTemplate.findUnique({
    where: { id: parsed.data },
  });
  if (!template) notFound();

  const versions = await prisma.documentTemplate.findMany({
    where: { code: template.code },
    orderBy: { version: "desc" },
    select: { id: true, version: true, status: true },
  });

  const documentCount = await prisma.generatedDocument.count({
    where: { templateId: template.id },
  });

  const isDraft = template.status === "DRAFT";
  const isActive = template.status === "MATO_APPROVED";

  return (
    <div className="space-y-6 anim-lock max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="label">
            <Link href="/settings/sjablonen" className="hover:text-[var(--accent)]">
              Documentsjablonen
            </Link>
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1">
            {template.name} <span className="mono text-lg text-[var(--text-dim)]">v{template.version}</span>
          </h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            {template.code} · {documentCategoryLabel(template.category)} · prefix{" "}
            <span className="mono">{template.numberPrefix}</span>
          </p>
        </div>
        <span className="badge shrink-0">{templateStatusLabel(template.status)}</span>
      </div>

      {versions.length > 1 && (
        <section className="panel p-4">
          <h2 className="label text-[var(--accent)] mb-2">Andere versies</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {versions.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/settings/sjablonen/${v.id}`}
                  className={v.id === template.id ? "badge badge-live" : "badge hover:text-[var(--accent)]"}
                >
                  v{v.version} · {templateStatusLabel(v.status)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {documentCount > 0 && (
        <p className="text-sm text-[var(--text-dim)]">
          {documentCount} {documentCount === 1 ? "document" : "documenten"} gemaakt met deze
          versie.
        </p>
      )}

      {isDraft ? (
        <form action={updateTemplateDraft} className="panel p-4 sm:p-6 space-y-4">
          <input type="hidden" name="templateId" value={template.id} />
          <div>
            <label className="label block mb-1">Naam</label>
            <input name="name" className="input" defaultValue={template.name} required maxLength={150} />
          </div>
          <div>
            <label className="label block mb-1">Inhoud</label>
            <TemplateBodyEditor defaultValue={template.body} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary">
              Bewaren
            </button>
          </div>
        </form>
      ) : (
        <section className="panel p-4 sm:p-6 space-y-3">
          <h2 className="label text-[var(--accent)]">Inhoud</h2>
          <p className="text-xs text-[var(--text-dim)]">
            {isActive
              ? "Actief — niet meer te bewerken. Maak een nieuwe versie voor wijzigingen."
              : "Vervangen — alleen nog leesbaar, gekoppeld aan documenten die ermee gemaakt zijn."}
          </p>
          <pre className="text-sm whitespace-pre-wrap font-mono bg-[var(--panel-2)] p-3 rounded">
            {template.body}
          </pre>
        </section>
      )}

      <section className="panel p-4 flex flex-wrap gap-2">
        {isDraft && (
          <form action={setTemplateActive}>
            <input type="hidden" name="templateId" value={template.id} />
            <button type="submit" className="btn btn-primary">
              Activeren
            </button>
          </form>
        )}
        <form action={createTemplateVersion}>
          <input type="hidden" name="templateId" value={template.id} />
          <button type="submit" className="btn">
            Nieuwe versie maken
          </button>
        </form>
      </section>
    </div>
  );
}
