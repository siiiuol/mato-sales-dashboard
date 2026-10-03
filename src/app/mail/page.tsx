import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import DirectMailComposer from "@/components/DirectMailComposer";

export const dynamic = "force-dynamic";

export default async function MailPage() {
  const user = await requirePageUser(["admin", "sales"]);

  const connection = await prisma.mailboxConnection.findUnique({
    where: { userId: user.id },
    select: { emailAddress: true },
  });

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">Mail</p>
        <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
          Losse mail
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Een gewoon bericht versturen, zonder lead en zonder AI. De huisstijl
          van matoautomaat.be zit er al op.
        </p>
      </div>

      {connection ? (
        <section className="panel p-4 sm:p-6">
          <DirectMailComposer
            senderName={user.name}
            ownEmail={connection.emailAddress ?? ""}
          />
        </section>
      ) : (
        <section className="panel p-4 sm:p-6">
          <p className="text-sm text-[var(--text-dim)]">
            Er is nog geen postvak aan je account gekoppeld, dus er kan niets
            verstuurd worden. Koppel het bij{" "}
            <Link href="/settings" className="text-[var(--accent)]">
              Instellingen
            </Link>
            .
          </p>
        </section>
      )}
    </div>
  );
}
