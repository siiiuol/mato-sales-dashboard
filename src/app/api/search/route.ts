import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, requireUser } from "@/lib/dal";

export type SearchHit = {
  id: string;
  title: string;
  detail: string;
  href: string;
  group:
    | "Leads"
    | "Customers"
    | "Deals"
    | "Quotes"
    | "Products"
    | "Suppliers"
    | "Sourcing"
    | "Contacts"
    | "Tasks"
    | "Creatives"
    | "Documents";
};

export async function GET(request: Request) {
  try {
    await requireUser(["admin", "sales", "reviewer"]);
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2 || q.length > 80) {
      return NextResponse.json({ hits: [] as SearchHit[] });
    }

    const [
      leads,
      customers,
      deals,
      quotes,
      products,
      suppliers,
      sourcing,
      contacts,
      tasks,
      creatives,
      documents,
    ] = await Promise.all([
      prisma.lead.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { city: { contains: q } },
            { phone: { contains: q } },
          ],
        },
        orderBy: { score: "desc" },
        take: 6,
        select: { id: true, name: true, city: true, score: true, status: true },
      }),
      prisma.customer.findMany({
        where: { name: { contains: q } },
        take: 4,
        select: { id: true, name: true, city: true },
      }),
      prisma.deal.findMany({
        where: { title: { contains: q } },
        take: 4,
        select: { id: true, title: true, stage: true },
      }),
      prisma.quote.findMany({
        where: { number: { contains: q } },
        take: 4,
        select: { id: true, number: true, status: true },
      }),
      prisma.product.findMany({
        where: { active: true, name: { contains: q } },
        take: 4,
        select: { id: true, name: true, line: true },
      }),
      prisma.supplier.findMany({
        where: {
          OR: [{ name: { contains: q } }, { categories: { contains: q } }],
        },
        take: 4,
        select: { id: true, name: true, country: true, status: true },
      }),
      prisma.sourcingRequest.findMany({
        where: { OR: [{ title: { contains: q } }, { code: { contains: q } }] },
        take: 4,
        select: { id: true, code: true, title: true, status: true },
      }),
      prisma.contact.findMany({
        where: {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
            { jobTitle: { contains: q } },
          ],
        },
        take: 5,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          decisionMaker: true,
        },
      }),
      prisma.task.findMany({
        where: { title: { contains: q }, status: { notIn: ["DONE", "CANCELLED"] } },
        take: 4,
        select: { id: true, title: true, status: true, dueAt: true },
      }),
      prisma.creativeRequest.findMany({
        where: { OR: [{ title: { contains: q } }, { code: { contains: q } }] },
        take: 4,
        select: { id: true, code: true, title: true, status: true },
      }),
      prisma.generatedDocument.findMany({
        where: { OR: [{ title: { contains: q } }, { number: { contains: q } }] },
        take: 5,
        select: { id: true, number: true, title: true, status: true },
      }),
    ]);

    const hits: SearchHit[] = [
      ...leads.map((l) => ({
        id: `lead-${l.id}`,
        title: l.name,
        detail: `${l.city ?? "—"} · ${l.status} · ${l.score}`,
        href: `/leads/${l.id}`,
        group: "Leads" as const,
      })),
      ...customers.map((c) => ({
        id: `customer-${c.id}`,
        title: c.name,
        detail: c.city ?? "customer",
        href: "/customers",
        group: "Customers" as const,
      })),
      ...deals.map((d) => ({
        id: `deal-${d.id}`,
        title: d.title,
        detail: d.stage,
        href: "/deals",
        group: "Deals" as const,
      })),
      ...quotes.map((qt) => ({
        id: `quote-${qt.id}`,
        title: qt.number,
        detail: qt.status,
        href: "/quotes",
        group: "Quotes" as const,
      })),
      ...products.map((p) => ({
        id: `product-${p.id}`,
        title: p.name,
        detail: p.line,
        href: "/catalog",
        group: "Products" as const,
      })),
      ...suppliers.map((s) => ({
        id: `supplier-${s.id}`,
        title: s.name,
        detail: `${s.country} · ${s.status}`,
        href: `/suppliers/${s.id}`,
        group: "Suppliers" as const,
      })),
      ...sourcing.map((r) => ({
        id: `sourcing-${r.id}`,
        title: `${r.code} · ${r.title}`,
        detail: r.status,
        href: `/sourcing/${r.id}`,
        group: "Sourcing" as const,
      })),
      ...contacts.map((c) => ({
        id: `contact-${c.id}`,
        title: [c.firstName, c.lastName].filter(Boolean).join(" "),
        detail: [c.jobTitle, c.decisionMaker ? "decision-maker" : null]
          .filter(Boolean)
          .join(" · "),
        href: "/contacts",
        group: "Contacts" as const,
      })),
      ...tasks.map((t) => ({
        id: `task-${t.id}`,
        title: t.title,
        detail: t.dueAt
          ? `${t.status} · due ${t.dueAt.toLocaleDateString("nl-BE")}`
          : t.status,
        href: "/tasks",
        group: "Tasks" as const,
      })),
      ...creatives.map((c) => ({
        id: `creative-${c.id}`,
        title: `${c.code} · ${c.title}`,
        detail: c.status.replaceAll("_", " "),
        href: `/marketing/creatives/${c.id}`,
        group: "Creatives" as const,
      })),
      ...documents.map((d) => ({
        id: `document-${d.id}`,
        title: `${d.number} · ${d.title}`,
        detail: d.status,
        href: `/documents/${d.id}`,
        group: "Documents" as const,
      })),
    ];

    return NextResponse.json({ hits });
  } catch (error) {
    return apiError(error);
  }
}
