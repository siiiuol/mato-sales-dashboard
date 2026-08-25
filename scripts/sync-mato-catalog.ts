/**
 * Synchroniseert de productcatalogus met matoautomaat.be (zie mato-catalog.ts).
 * Deactiveert oude demo-SKU’s; upsert op sku.
 */
import { PrismaClient } from "@prisma/client";
import {
  LEGACY_PRODUCT_SKUS,
  MATO_CATALOG,
} from "../src/lib/mato-catalog";

const prisma = new PrismaClient();

async function main() {
  for (const p of MATO_CATALOG) {
    const existing = await prisma.product.findFirst({ where: { sku: p.sku } });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: p.name,
          line: p.line,
          description: p.description,
          specs: p.specs,
          listPrice: p.listPrice,
          cost: p.cost,
          recurring: p.recurring ?? false,
          active: true,
        },
      });
      console.log(`update ${p.sku} · ${p.name}`);
    } else {
      await prisma.product.create({
        data: {
          name: p.name,
          line: p.line,
          sku: p.sku,
          description: p.description,
          specs: p.specs,
          listPrice: p.listPrice,
          cost: p.cost,
          recurring: p.recurring ?? false,
          active: true,
        },
      });
      console.log(`create ${p.sku} · ${p.name}`);
    }
  }

  for (const sku of LEGACY_PRODUCT_SKUS) {
    const r = await prisma.product.updateMany({
      where: { sku },
      data: { active: false },
    });
    if (r.count) console.log(`deactivate legacy ${sku}`);
  }

  const active = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ line: "asc" }, { name: "asc" }],
    select: { sku: true, name: true, line: true, listPrice: true },
  });
  console.log("\nActief:");
  for (const p of active) {
    console.log(
      `  ${p.line.padEnd(10)} ${String(p.sku).padEnd(14)} ${p.name} · €${p.listPrice || "op aanvraag"}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
