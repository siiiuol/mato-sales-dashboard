/**
 * Zet het MATO-team recht: Xin Chen (eigenaar) + Louis Bogaert (freelancer).
 *
 * Louis: €1.500/maand, 8% op verkoop, €500 per geslaagd shop-huurcontract.
 * Xin: beheerder, geen freelancer-kost/commissie in dit model.
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const defaultPassword = process.env.MATO_ADMIN_PASSWORD || "mato-admin-dev";
  const passwordHash = await hash(defaultPassword, 12);

  const xin = await prisma.user.upsert({
    where: { email: "xin@matoautomaat.be" },
    update: {
      name: "Xin Chen",
      role: "admin",
      active: true,
      monthlyCost: 0,
      commissionType: "PERCENT",
      commissionValue: 0,
      rentalCommissionFixed: 0,
    },
    create: {
      email: "xin@matoautomaat.be",
      name: "Xin Chen",
      role: "admin",
      passwordHash,
      monthlyCost: 0,
      commissionType: "PERCENT",
      commissionValue: 0,
      rentalCommissionFixed: 0,
      startedAt: new Date(),
    },
  });

  const louis = await prisma.user.upsert({
    where: { email: "louis@matoautomaat.be" },
    update: {
      name: "Louis Bogaert",
      role: "sales",
      active: true,
      monthlyCost: 1500,
      commissionType: "PERCENT",
      commissionValue: 8,
      rentalCommissionFixed: 500,
    },
    create: {
      email: "louis@matoautomaat.be",
      name: "Louis Bogaert",
      role: "sales",
      passwordHash,
      monthlyCost: 1500,
      commissionType: "PERCENT",
      commissionValue: 8,
      rentalCommissionFixed: 500,
      startedAt: new Date(),
    },
  });

  // Oude seed-admin deactiveren als die nog bestaat (niet Xin/Louis).
  await prisma.user.updateMany({
    where: {
      email: { in: ["admin@mato.local"] },
      id: { notIn: [xin.id, louis.id] },
    },
    data: { active: false },
  });

  console.log("Team:");
  console.log(`  ${xin.name} <${xin.email}> · admin · kost €0`);
  console.log(
    `  ${louis.name} <${louis.email}> · sales · €1500/m · 8% verkoop · €500/huur`
  );
  console.log(`Login-wachtwoord (nieuw of ongewijzigd bij upsert create): ${defaultPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
