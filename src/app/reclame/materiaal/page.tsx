import Link from "next/link";
import { requirePageUser } from "@/lib/dal";
import {
  MATO_PDF_PACK_LABELS,
  MATO_PDF_TEMPLATES,
  matoPdfHref,
  type MatoPdfTemplate,
} from "@/lib/mato-pdf-templates";

export const dynamic = "force-dynamic";

/**
 * Downloadbare + invulbare MATO PDF-sjablonen.
 */
export default async function ReclameMateriaalPage() {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const canFill = user.role === "admin" || user.role === "sales";

  const packs = (["partner", "sales", "ops", "legal"] as const).map((pack) => ({
    pack,
    label: MATO_PDF_PACK_LABELS[pack],
    items: MATO_PDF_TEMPLATES.filter((t) => t.pack === pack),
  }));

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">Reclame</p>
        <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
          Materiaal
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1 max-w-2xl">
          Officiële sjablonen: download de PDF-huisstijl of{" "}
          <strong>vul in</strong> en maak een genummerd document in MATO OS.
        </p>
      </div>

      {packs.map(
        (group) =>
          group.items.length > 0 && (
            <section key={group.pack} className="space-y-3">
              <h2 className="label text-[var(--accent)]">{group.label}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {group.items.map((t) => (
                  <TemplateCard key={t.id} template={t} canFill={canFill} />
                ))}
              </ul>
            </section>
          )
      )}
    </div>
  );
}

function TemplateCard({
  template,
  canFill,
}: {
  template: MatoPdfTemplate;
  canFill: boolean;
}) {
  return (
    <li className="panel p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--text-mute)] mono">
            {String(template.order).padStart(2, "0")}
          </p>
          <h3 className="font-medium">{template.title}</h3>
        </div>
        <span className="badge shrink-0">{template.dealFit}</span>
      </div>
      <p className="text-sm text-[var(--text-dim)] flex-1">{template.summary}</p>
      <div className="flex flex-wrap gap-2">
        {canFill && (
          <Link
            href={`/reclame/materiaal/${template.id}`}
            className="btn btn-primary text-sm"
          >
            Invullen
          </Link>
        )}
        <a
          href={matoPdfHref(template.file)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn text-sm"
        >
          PDF openen
        </a>
        <a
          href={matoPdfHref(template.file)}
          download={template.file}
          className="btn text-sm"
        >
          Downloaden
        </a>
      </div>
    </li>
  );
}
