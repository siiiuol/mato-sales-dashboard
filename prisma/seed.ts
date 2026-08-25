import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { DEFAULT_DETECTION_CATEGORIES } from "../src/lib/constants";
import {
  CONTRACT_BODY,
  CONTRACT_CODE,
  CONTRACT_PREFIX,
} from "../src/lib/contract-template";
import { PARTNER_TEMPLATES } from "../src/lib/partner-templates";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.MATO_ADMIN_EMAIL || "admin@mato.local").toLowerCase();
  const configuredHash = process.env.MATO_ADMIN_PASSWORD_HASH;
  const configuredPassword = process.env.MATO_ADMIN_PASSWORD;

  // Het ontwikkelwachtwoord staat in de README en dus feitelijk op straat.
  // Buiten development moet er een echt wachtwoord gezet zijn, anders zou een
  // productie-omgeving met een publiek bekende login online komen te staan.
  if (!configuredHash && !configuredPassword && process.env.NODE_ENV === "production") {
    throw new Error(
      "Zet MATO_ADMIN_PASSWORD_HASH of MATO_ADMIN_PASSWORD voordat je in productie seedt — " +
        "het ontwikkelwachtwoord uit de README is publiek bekend."
    );
  }

  const passwordHash =
    configuredHash || (await hash(configuredPassword || "mato-admin-dev", 12));
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: process.env.MATO_ADMIN_NAME || "MATO Admin",
      role: "admin",
      active: true,
      ...(configuredHash || configuredPassword ? { passwordHash } : {}),
    },
    create: {
      email: adminEmail,
      name: process.env.MATO_ADMIN_NAME || "MATO Admin",
      role: "admin",
      passwordHash,
    },
  });

  const categories = JSON.stringify([...DEFAULT_DETECTION_CATEGORIES]);

  await prisma.appSettings.upsert({
    where: { id: "default" },
    // Bewust niet meer overschreven bij elke seed: dit veld is instelbaar in de
    // app, en het terugzetten naar de standaard maakte een keuze van de
    // gebruiker stilzwijgend ongedaan.
    update: {},
    create: {
      id: "default",
      businessName: "MATO",
      currency: "EUR",
      timezone: "Europe/Brussels",
      accent: "green",
      detectionCategories: categories,
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
    // Zie src/lib/mato-catalog.ts — sync met scripts/sync-mato-catalog.ts
    {
      name: "MATO B1",
      line: "MACHINE",
      sku: "MATO-B1",
      description:
        "Verkoopautomaat met liftsysteem voor fragiele producten (brood, gebak, taart).",
      specs: "lift · food",
      listPrice: 0,
      cost: 0,
    },
    {
      name: "MATO M1",
      line: "MACHINE",
      sku: "MATO-M1",
      description:
        "Verkoopautomaat met liftsysteem voor fragiele producten — middelgroot gamma.",
      specs: "lift · food · middenformaat",
      listPrice: 0,
      cost: 0,
    },
    {
      name: "MATO S1",
      line: "MACHINE",
      sku: "MATO-S1",
      description:
        "Verkoopautomaat met liftsysteem voor fragiele producten — compact.",
      specs: "lift · food · compact",
      listPrice: 0,
      cost: 0,
    },
    {
      name: "MATO C1",
      line: "MACHINE",
      sku: "MATO-C1",
      description:
        "Verkoopautomaat met valsysteem voor blikjes en flessen. Instapmodel.",
      specs: "val · drank · instap",
      listPrice: 6500,
      cost: 0,
    },
    {
      name: "MATO F1",
      line: "MACHINE",
      sku: "MATO-F1",
      description:
        "Diepvriesautomaat tot −20 °C met schuifbak — ijs en diepvriesproducten.",
      specs: "diepvries · −20 °C",
      listPrice: 0,
      cost: 0,
    },
    {
      name: "MATO L1",
      line: "MACHINE",
      sku: "MATO-L1",
      description:
        "Gekoelde lockervakken op maat — bloemen, taarten per stuk, cadeaus.",
      specs: "locker · gekoeld",
      listPrice: 0,
      cost: 0,
    },
    {
      name: "MATO T1",
      line: "MACHINE",
      sku: "MATO-T1",
      description:
        "Touchscreen-automaat: meerdere producten in één aankoop.",
      specs: "touchscreen · groot assortiment",
      listPrice: 0,
      cost: 0,
    },
    {
      name: "Behuizing / wrapping op maat",
      line: "BEHUIZING",
      sku: "MATO-BEH-STD",
      description: "Behuizing en wrapping afgestemd op het concept.",
      specs: "op maat · branding",
      listPrice: 0,
      cost: 0,
    },
    {
      name: "Verpakkingsoplossingen",
      line: "PACKAGING",
      sku: "MATO-PKG",
      description: "Verpakking voor producten in de automaat.",
      specs: "op maat · food",
      listPrice: 0,
      cost: 0,
    },
    {
      name: "Betaalterminal",
      line: "TERMINAL",
      sku: "MATO-PAY",
      description: "Betaaloplossing voor de automaat (cashless).",
      specs: "contactloos",
      listPrice: 0,
      cost: 0,
    },
    {
      name: "Telemetrie",
      line: "TELEMETRY",
      sku: "MATO-TEL",
      description: "Opvolging van verkoop, voorraad en prestaties op afstand.",
      specs: "remote",
      listPrice: 0,
      cost: 0,
    },
  ];

  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { sku: p.sku } });
    if (!existing) {
      await prisma.product.create({ data: p });
    }
  }

  // Het contractsjabloon. Versie 1 wordt alleen aangemaakt als ze er nog niet
  // is: aanpassingen die in de app gedaan zijn mogen niet teruggedraaid worden
  // door opnieuw te seeden.
  const existingTemplate = await prisma.documentTemplate.findFirst({
    where: { code: CONTRACT_CODE, version: 1 },
  });
  if (!existingTemplate) {
    await prisma.documentTemplate.create({
      data: {
        code: CONTRACT_CODE,
        name: "Verkoopovereenkomst",
        category: "SALES",
        language: "nl",
        version: 1,
        // Enige geldige "actief"-status uit TEMPLATE_STATUSES — "ACTIVE" bestaat
        // daar niet en zou door een statusfilter nooit gevonden worden.
        status: "MATO_APPROVED",
        numberPrefix: CONTRACT_PREFIX,
        body: CONTRACT_BODY,
        outputFormats: "PDF",
        effectiveAt: new Date(),
      },
    });
  }

  // Partnersjablonen — actief zodat Materiaal → Invullen meteen werkt.
  // Bestaande rijen die nog DRAFT zijn, worden niet hier omgezet (dat gebeurt
  // bij eerste invullen of handmatig bij Documentsjablonen).
  for (const t of PARTNER_TEMPLATES) {
    const existingPartnerTemplate = await prisma.documentTemplate.findFirst({
      where: { code: t.code, version: 1 },
    });
    if (!existingPartnerTemplate) {
      await prisma.documentTemplate.create({
        data: {
          code: t.code,
          name: t.name,
          category: t.category,
          language: "nl",
          version: 1,
          status: "MATO_APPROVED",
          numberPrefix: t.prefix,
          body: t.body,
          outputFormats: "PDF",
          effectiveAt: new Date(),
        },
      });
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
