import Link from "next/link";
import { requirePageUser } from "@/lib/dal";
import { ContentIdeasPanel } from "@/components/AiosTools";

export const dynamic = "force-dynamic";

export default async function AiosContentPage() {
  await requirePageUser(["admin", "sales"]);

  return (
    <div className="space-y-6 anim-lock max-w-3xl">
      <div>
        <Link href="/aios" className="label text-[var(--accent)]">
          ← Assistent
        </Link>
        <h1 className="display text-3xl tracking-tight mt-1">
          Contentideeën
        </h1>
        <p className="mt-2 text-[var(--text-dim)]">
          Ideeën die matoautomaat.be helpen verkopen of verhuren — klaar om in
          Reclame te gebruiken.
        </p>
      </div>
      <ContentIdeasPanel />
    </div>
  );
}
