import Link from "next/link";
import { requirePageUser } from "@/lib/dal";
import { createTemplate } from "@/lib/template-actions";
import { DOCUMENT_CATEGORIES, documentCategoryLabel } from "@/lib/constants";
import { TemplateBodyEditor } from "@/components/TemplateBodyEditor";

export const dynamic = "force-dynamic";

export default async function NieuwSjabloonPage() {
  await requirePageUser(["admin"]);

  return (
    <div className="space-y-6 anim-lock max-w-3xl">
      <div>
        <p className="label">
          <Link href="/settings/sjablonen" className="hover:text-[var(--accent)]">
            Documentsjablonen
          </Link>
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Nieuw sjabloon</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Begint als concept — pas na activeren (op de sjabloonpagina zelf) is het
          bruikbaar om documenten uit te genereren.
        </p>
      </div>

      <form action={createTemplate} className="panel p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1">Code</label>
            <input
              name="code"
              className="input mono"
              placeholder="OPSTART"
              required
              maxLength={40}
            />
            <p className="text-xs text-[var(--text-dim)] mt-1">
              Hoofdletters, cijfers, underscore — identificeert dit sjabloon voorgoed.
            </p>
          </div>
          <div>
            <label className="label block mb-1">Nummerprefix</label>
            <input name="numberPrefix" className="input mono" placeholder="MATO-OP" required maxLength={20} />
          </div>
        </div>

        <div>
          <label className="label block mb-1">Naam</label>
          <input name="name" className="input" placeholder="Opstartbevestiging" required maxLength={150} />
        </div>

        <div>
          <label className="label block mb-1">Categorie</label>
          <select name="category" className="select" defaultValue={DOCUMENT_CATEGORIES[0]}>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {documentCategoryLabel(c)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label block mb-1">Inhoud</label>
          <TemplateBodyEditor />
        </div>

        <button type="submit" className="btn btn-primary">
          Sjabloon aanmaken
        </button>
      </form>
    </div>
  );
}
