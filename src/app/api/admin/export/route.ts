import { apiError, requireUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireUser(["admin"]);
    const entity = new URL(request.url).searchParams.get("entity");
    const stamp = new Date().toISOString().slice(0, 10);
    let csv: string;
    let filename: string;

    if (entity === "customers") {
      const rows = await prisma.customer.findMany({ orderBy: { createdAt: "asc" } });
      csv = toCsv(
        [
          "id",
          "name",
          "kind",
          "address",
          "city",
          "province",
          "phone",
          "email",
          "website",
          "nextActionAt",
          "createdAt",
        ],
        rows.map((row) => [
          row.id,
          row.name,
          row.kind,
          row.address,
          row.city,
          row.province,
          row.phone,
          row.email,
          row.website,
          row.nextActionAt,
          row.createdAt,
        ])
      );
      filename = `mato-klanten-${stamp}.csv`;
    } else if (entity === "shop") {
      const rows = await prisma.machinePlacement.findMany({
        where: { site: "SHOP_DIKSMUIDE" },
        orderBy: { createdAt: "asc" },
        include: {
          customer: { select: { name: true, phone: true, email: true } },
          product: { select: { name: true, sku: true } },
        },
      });
      csv = toCsv(
        [
          "id",
          "huurder",
          "phone",
          "email",
          "plaats",
          "product",
          "sku",
          "serienummer",
          "contracttype",
          "contractreferentie",
          "contractStart",
          "contractEinde",
          "opzegtermijnDagen",
          "verlengstatus",
          "status",
        ],
        rows.map((row) => [
          row.id,
          row.customer.name,
          row.customer.phone,
          row.customer.email,
          row.shopSlot,
          row.product?.name ?? row.model,
          row.product?.sku,
          row.serialNumber,
          row.contractType,
          row.contractRef,
          row.contractStartedAt,
          row.contractEndsAt,
          row.noticePeriodDays,
          row.renewalStatus,
          row.status,
        ])
      );
      filename = `mato-shop-${stamp}.csv`;
    } else {
      const rows = await prisma.lead.findMany({
        orderBy: { createdAt: "asc" },
        include: {
          owner: { select: { email: true } },
          campaign: { select: { name: true } },
        },
      });
      csv = toCsv(
        [
          "id",
          "name",
          "address",
          "city",
          "province",
          "category",
          "phone",
          "email",
          "website",
          "source",
          "status",
          "complianceStatus",
          "ownerEmail",
          "campaign",
          "nextActionAt",
          "notes",
          "createdAt",
        ],
        rows.map((row) => [
          row.id,
          row.name,
          row.address,
          row.city,
          row.province,
          row.category,
          row.phone,
          row.email,
          row.website,
          row.source,
          row.status,
          row.complianceStatus,
          row.owner?.email,
          row.campaign?.name,
          row.nextActionAt,
          row.notes,
          row.createdAt,
        ])
      );
      filename = `mato-leads-${stamp}.csv`;
    }

    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
