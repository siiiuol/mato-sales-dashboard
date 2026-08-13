import { PrismaClient } from "@prisma/client";

/**
 * Zet de openbare Entra-gegevens klaar.
 *
 * Alleen de tenant- en client-id: die staan sowieso in elke autorisatie-URL en
 * zijn niet geheim. Het clientgeheim hoort hier niet in een bestand te staan —
 * dat gaat via het invoerveld bij Instellingen, versleuteld de database in.
 */

const TENANT_ID = "afde93d1-87e5-4c45-a8d1-9a27172764a5";
const CLIENT_ID = "d7aee553-d2f1-4bba-be74-0ee359c07350";

const prisma = new PrismaClient();

const settings = await prisma.appSettings.upsert({
  where: { id: "default" },
  update: { msTenantId: TENANT_ID, msClientId: CLIENT_ID },
  create: { id: "default", msTenantId: TENANT_ID, msClientId: CLIENT_ID },
});

console.log("tenant-id :", settings.msTenantId);
console.log("client-id :", settings.msClientId);
console.log(
  "geheim    :",
  settings.msClientSecret ? "ingevuld" : "nog niet ingevuld (via Instellingen)"
);

await prisma.$disconnect();
