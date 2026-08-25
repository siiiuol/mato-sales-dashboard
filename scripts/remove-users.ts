/**
 * Verwijder MATO Admin en Jonas Vermeulen (accounts + loskoppelen van data).
 * Xin en Louis blijven staan.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REMOVE_EMAILS = ["admin@mato.local", "jonas@mato.local"];

async function main() {
  const victims = await prisma.user.findMany({
    where: { email: { in: REMOVE_EMAILS } },
    select: { id: true, name: true, email: true },
  });
  if (!victims.length) {
    console.log("Niemand te verwijderen.");
    return;
  }
  const ids = victims.map((v) => v.id);
  console.log(
    "Verwijderen:",
    victims.map((v) => `${v.name} <${v.email}>`).join(", ")
  );

  const xin = await prisma.user.findUnique({
    where: { email: "xin@matoautomaat.be" },
    select: { id: true },
  });
  const fallback = xin?.id ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.lead.updateMany({
      where: { ownerId: { in: ids } },
      data: { ownerId: fallback },
    });
    await tx.lead.updateMany({
      where: { claimedById: { in: ids } },
      data: { claimedById: null, claimedAt: null },
    });
    await tx.deal.updateMany({
      where: { ownerId: { in: ids } },
      data: { ownerId: fallback },
    });
    await tx.customer.updateMany({
      where: { ownerId: { in: ids } },
      data: { ownerId: fallback },
    });
    await tx.task.updateMany({
      where: { assignedToId: { in: ids } },
      data: { assignedToId: fallback },
    });
    await tx.outreachEvent.updateMany({
      where: { createdById: { in: ids } },
      data: { createdById: fallback },
    });
    await tx.auditEvent.updateMany({
      where: { actorId: { in: ids } },
      data: { actorId: fallback },
    });
    await tx.emailDraft.updateMany({
      where: { createdById: { in: ids } },
      data: { createdById: fallback },
    });
    await tx.mailMessage.updateMany({
      where: { userId: { in: ids } },
      data: { userId: fallback },
    });
    await tx.generatedDocument.updateMany({
      where: { createdById: { in: ids } },
      data: { createdById: fallback },
    });
    await tx.generatedDocument.updateMany({
      where: { approvedById: { in: ids } },
      data: { approvedById: fallback },
    });
    await tx.documentTemplate.updateMany({
      where: { ownerId: { in: ids } },
      data: { ownerId: fallback },
    });
    await tx.documentTemplate.updateMany({
      where: { approvedById: { in: ids } },
      data: { approvedById: fallback },
    });
    await tx.mailSnippet.updateMany({
      where: { updatedById: { in: ids } },
      data: { updatedById: fallback },
    });
    await tx.mailboxConnection.deleteMany({
      where: { userId: { in: ids } },
    });

    // Overige relaties die kunnen blokkeren
    await tx.contact.updateMany({
      where: { ownerId: { in: ids } },
      data: { ownerId: fallback },
    });
    await tx.brandAsset.updateMany({
      where: { ownerId: { in: ids } },
      data: { ownerId: fallback },
    }).catch(() => undefined);
    await tx.sourcingRequest.updateMany({
      where: { requestedById: { in: ids } },
      data: { requestedById: fallback },
    }).catch(() => undefined);
    await tx.creativeRequest.updateMany({
      where: { requestedById: { in: ids } },
      data: { requestedById: fallback },
    }).catch(() => undefined);
    await tx.creativeRequest.updateMany({
      where: { assignedToId: { in: ids } },
      data: { assignedToId: fallback },
    }).catch(() => undefined);
    await tx.creativeRequest.updateMany({
      where: { approvedById: { in: ids } },
      data: { approvedById: fallback },
    }).catch(() => undefined);
    await tx.creativeVersion.updateMany({
      where: { createdById: { in: ids } },
      data: { createdById: fallback },
    }).catch(() => undefined);

    await tx.user.deleteMany({ where: { id: { in: ids } } });
  });

  console.log("Klaar.");
  const left = await prisma.user.findMany({
    select: { name: true, email: true, role: true },
  });
  for (const u of left) console.log(`  ${u.role} · ${u.name} <${u.email}>`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
