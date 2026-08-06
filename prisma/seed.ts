import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.MATO_ADMIN_EMAIL || "admin@mato.local").toLowerCase();
  const configuredHash = process.env.MATO_ADMIN_PASSWORD_HASH;
  const passwordHash =
    configuredHash ||
    (await hash(process.env.MATO_ADMIN_PASSWORD || "mato-admin-dev", 12));
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: process.env.MATO_ADMIN_NAME || "MATO Admin",
      role: "admin",
      active: true,
      ...(configuredHash || process.env.MATO_ADMIN_PASSWORD ? { passwordHash } : {}),
    },
    create: {
      email: adminEmail,
      name: process.env.MATO_ADMIN_NAME || "MATO Admin",
      role: "admin",
      passwordHash,
    },
  });

  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {
      detectionCategories: JSON.stringify([
        "bakery",
        "butcher",
        "patisserie",
        "traiteur",
        "chocolatier",
        "florist",
        "farm shop",
      ]),
    },
    create: {
      id: "default",
      businessName: "MATO",
      currency: "EUR",
      timezone: "Europe/Brussels",
      accent: "green",
      detectionCategories: JSON.stringify([
        "bakery",
        "butcher",
        "patisserie",
        "traiteur",
        "chocolatier",
        "florist",
        "farm shop",
      ]),
      pitchTemplates: JSON.stringify({
        MACHINE:
          "Goedemiddag, hier is MATO. Wij leveren verkoopautomaten, behuizing en betalings- en telemetrie-oplossingen in Vlaanderen. Mag ik kort toelichten wat we voor jullie locatie kunnen betekenen?",
        TELEMETRY:
          "Goedemiddag, MATO hier. Veel klanten combineren hun automaten met onze telemetrie zodat ze stock en omzet realtime zien. Interesse in een korte demo?",
        TERMINAL:
          "Goedemiddag, MATO. Wij plaatsen moderne betaalterminals op verkoopautomaten — cashless, snel, betrouwbaar. Past dat bij jullie setup?",
      }),
    },
  });

  const products = [
    {
      name: "MATO Snack Pro 6",
      line: "MACHINE",
      sku: "MCH-SNK-6",
      description: "Snackautomaat 6 trays",
      specs: "snack/combo · 6 trays",
      listPrice: 4200,
      cost: 2800,
    },
    {
      name: "MATO Drink Chill 8",
      line: "MACHINE",
      sku: "MCH-DRK-8",
      description: "Drankautomaat gekoeld",
      specs: "drink · 8 spirals",
      listPrice: 5100,
      cost: 3400,
    },
    {
      name: "Behuizing SteelLock M",
      line: "BEHUIZING",
      sku: "BEH-SL-M",
      description: "Stalen outdoor behuizing medium",
      specs: "Ral 7016 · medium",
      listPrice: 890,
      cost: 520,
    },
    {
      name: "Behuizing SteelLock L",
      line: "BEHUIZING",
      sku: "BEH-SL-L",
      description: "Stalen outdoor behuizing large",
      specs: "Ral 7016 · large",
      listPrice: 1190,
      cost: 700,
    },
    {
      name: "Verpakkingskit Standaard",
      line: "PACKAGING",
      sku: "PKG-STD",
      description: "Beschermende transportverpakking",
      specs: "kit · 1 machine",
      listPrice: 65,
      cost: 28,
    },
    {
      name: "PayPad Contactless",
      line: "TERMINAL",
      sku: "TRM-PP-1",
      description: "Contactloze betaalterminal",
      specs: "NFC · QR",
      listPrice: 349,
      cost: 210,
    },
    {
      name: "PayPad + Cash Module",
      line: "TERMINAL",
      sku: "TRM-PP-C",
      description: "Terminal met cash module",
      specs: "NFC · cash",
      listPrice: 620,
      cost: 390,
    },
    {
      name: "MATO Telemetry Hub",
      line: "TELEMETRY",
      sku: "TEL-HUB",
      description: "Hardware hub + first year connectivity",
      specs: "4G · one-off",
      listPrice: 299,
      cost: 140,
    },
    {
      name: "MATO Telemetry Plan",
      line: "TELEMETRY",
      sku: "TEL-PLAN",
      description: "Maandelijks telemetrie-abonnement",
      specs: "per machine · maand",
      listPrice: 19,
      cost: 6,
      recurring: true,
    },
  ];

  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { sku: p.sku } });
    if (!existing) {
      await prisma.product.create({ data: p });
    }
  }

  // No demo leads or demo deals.
  // Real queue data: KBO Open Data import + OpenStreetMap enrich/scan.

  console.log("MATO seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
