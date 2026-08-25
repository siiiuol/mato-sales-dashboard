import "server-only";

import { prisma } from "./db";
import type { SearchHit } from "./search-types";

export type { SearchHit } from "./search-types";
export { searchTypeLabel } from "./search-types";

/**
 * Zoekt over verkoop, shop, automaten, documenten en open werk.
 * SQLite: `contains` is hoofdlettergevoelig — we zoeken op trim van de query.
 */
export async function searchEverything(
  q: string,
  limit = 20
): Promise<SearchHit[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  const per = Math.max(4, Math.ceil(limit / 7));
  const slot = /^\d+$/.test(query) ? Number(query) : null;

  const [leads, buyers, tenants, documents, machines, tasks, deals] =
    await Promise.all([
    prisma.lead.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { city: { contains: query } },
          { phone: { contains: query } },
          { email: { contains: query } },
          { address: { contains: query } },
        ],
      },
      take: per,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        city: true,
        phone: true,
        status: true,
      },
    }),
    prisma.customer.findMany({
      where: {
        kind: "BUYER",
        OR: [
          { name: { contains: query } },
          { city: { contains: query } },
          { phone: { contains: query } },
          { email: { contains: query } },
        ],
      },
      take: per,
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, city: true, phone: true },
    }),
    prisma.customer.findMany({
      where: {
        kind: "SHOP_TENANT",
        OR: [
          { name: { contains: query } },
          { phone: { contains: query } },
          { email: { contains: query } },
        ],
      },
      take: per,
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, phone: true, email: true },
    }),
      prisma.generatedDocument.findMany({
      where: {
        OR: [
          { number: { contains: query } },
          { title: { contains: query } },
          { signerName: { contains: query } },
        ],
      },
      take: per,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        title: true,
        leadId: true,
        customerId: true,
      },
      }),
      prisma.machinePlacement.findMany({
        where: {
          OR: [
            { serialNumber: { contains: query } },
            { contractRef: { contains: query } },
            { model: { contains: query } },
            { customer: { is: { name: { contains: query } } } },
            { product: { is: { name: { contains: query } } } },
            ...(slot === null ? [] : [{ shopSlot: slot }]),
          ],
        },
        take: per,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          serialNumber: true,
          contractRef: true,
          model: true,
          site: true,
          shopSlot: true,
          status: true,
          customer: { select: { id: true, name: true, kind: true } },
          product: { select: { name: true } },
        },
      }),
      prisma.task.findMany({
        where: {
          status: "OPEN",
          OR: [
            { title: { contains: query } },
            { description: { contains: query } },
            { lead: { is: { name: { contains: query } } } },
            { customer: { is: { name: { contains: query } } } },
          ],
        },
        take: per,
        orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
        select: {
          id: true,
          title: true,
          dueAt: true,
          lead: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, kind: true } },
        },
      }),
      prisma.deal.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { nextStep: { contains: query } },
            { lead: { is: { name: { contains: query } } } },
            { customer: { is: { name: { contains: query } } } },
            {
              lines: {
                some: { product: { is: { name: { contains: query } } } },
              },
            },
          ],
        },
        take: per,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          stage: true,
          nextStep: true,
          lead: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, kind: true } },
        },
      }),
    ]);

  const hits: SearchHit[] = [
    ...machines.map((machine) => ({
      type: "machine" as const,
      id: machine.id,
      title: `${machine.customer.name} · ${
        machine.serialNumber ??
        machine.product?.name ??
        machine.model ??
        "Automaat"
      }`,
      subtitle: [
        machine.contractRef ? `Contract ${machine.contractRef}` : null,
        machine.shopSlot ? `Shopplaats ${machine.shopSlot}` : machine.site,
        machine.status,
      ]
        .filter(Boolean)
        .join(" · "),
      href:
        machine.customer.kind === "SHOP_TENANT"
          ? `/shop/${machine.customer.id}`
          : `/klanten/${machine.customer.id}`,
    })),
    ...documents.map((document) => ({
      type: "document" as const,
      id: document.id,
      title: document.number,
      subtitle: document.title,
      href: `/documenten/${document.id}`,
    })),
    ...deals.map((deal) => ({
      type: "deal" as const,
      id: deal.id,
      title: deal.title,
      subtitle: [
        deal.lead?.name ?? deal.customer?.name,
        deal.stage,
        deal.nextStep,
      ]
        .filter(Boolean)
        .join(" · "),
      href: deal.lead
        ? `/leads/${deal.lead.id}`
        : deal.customer?.kind === "SHOP_TENANT"
          ? `/shop/${deal.customer.id}`
          : deal.customer
            ? `/klanten/${deal.customer.id}`
            : "/",
    })),
    ...tasks.map((task) => ({
      type: "task" as const,
      id: task.id,
      title: task.title,
      subtitle: [
        task.lead?.name ?? task.customer?.name,
        task.dueAt ? `tegen ${task.dueAt.toLocaleDateString("nl-BE")}` : "zonder datum",
      ]
        .filter(Boolean)
        .join(" · "),
      href: task.lead
        ? `/leads/${task.lead.id}`
        : task.customer?.kind === "SHOP_TENANT"
          ? `/shop/${task.customer.id}`
          : task.customer
            ? `/klanten/${task.customer.id}`
            : "/taken",
    })),
    ...leads.map((l) => ({
      type: "lead" as const,
      id: l.id,
      title: l.name,
      subtitle: [l.city, l.phone, l.status].filter(Boolean).join(" · "),
      href: `/leads/${l.id}`,
    })),
    ...buyers.map((c) => ({
      type: "buyer" as const,
      id: c.id,
      title: c.name,
      subtitle: [c.city, c.phone, "Verkoopklant"].filter(Boolean).join(" · "),
      href: `/klanten/${c.id}`,
    })),
    ...tenants.map((c) => ({
      type: "tenant" as const,
      id: c.id,
      title: c.name,
      subtitle: [c.phone ?? c.email, "Shop-huurder"].filter(Boolean).join(" · "),
      href: `/shop/${c.id}`,
    })),
  ];

  return hits.slice(0, limit);
}
