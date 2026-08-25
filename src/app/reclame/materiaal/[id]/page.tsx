import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { templateKeys } from "@/lib/documents";
import { matoPdfById, matoPdfHref } from "@/lib/mato-pdf-templates";
import { PARTNER_TEMPLATES } from "@/lib/partner-templates";
import { MateriaalFillForm } from "@/components/MateriaalFillForm";

export const dynamic = "force-dynamic";

/**
 * Invulscherm voor één PDF-materiaalsjabloon.
 */
export default async function MateriaalFillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser(["admin", "sales"]);
  const { id } = await params;
  const pdf = matoPdfById(id);
  if (!pdf) notFound();

  const def = PARTNER_TEMPLATES.find((t) => t.code === pdf.templateCode);
  const dbTemplate = await prisma.documentTemplate.findFirst({
    where: { code: pdf.templateCode },
    orderBy: { version: "desc" },
    select: { body: true, status: true },
  });

  const body = dbTemplate?.body ?? def?.body ?? "";
  const fields = templateKeys(body).filter(
    (k) => k !== "datum" && k !== "documentnummer"
  );

  const leads = await prisma.lead.findMany({
    where: {
      ownerId: user.id,
      status: { in: ["NEW", "TO_CALL", "CONTACTED", "FOLLOW_UP", "NEGOTIATION", "WON"] },
    },
    orderBy: { name: "asc" },
    take: 80,
    select: { id: true, name: true, city: true, phone: true, email: true, address: true },
  });

  const defaults: Record<string, string> = {};
  // Geen auto-fill van een random lead — gebruiker kiest en typt.

  return (
    <div className="space-y-6 anim-lock max-w-6xl">
      <div>
        <Link href="/reclame/materiaal" className="label text-[var(--accent)]">
          ← Materiaal
        </Link>
        <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
          {pdf.title} invullen
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">{pdf.summary}</p>
        <p className="text-xs text-[var(--text-mute)] mt-2">
          Originele PDF:{" "}
          <a
            href={matoPdfHref(pdf.file)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            bekijken
          </a>
          {" · "}
          Code {pdf.templateCode}
          {dbTemplate ? ` · ${dbTemplate.status}` : " · wordt bij eerste invullen aangemaakt"}
        </p>
      </div>

      <section className="panel p-5">
        <MateriaalFillForm
          templateCode={pdf.templateCode}
          templateBody={body}
          fields={fields}
          defaults={defaults}
          leads={leads.map((l) => ({ id: l.id, name: l.name, city: l.city }))}
        />
      </section>
    </div>
  );
}
