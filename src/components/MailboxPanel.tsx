import { disconnectMailboxAction } from "@/lib/mail-actions";

/**
 * De koppelknop en de stand van zaken van de eigen mailbox.
 *
 * Elke medewerker koppelt zijn eigen postvak: mail vertrekt dan van zijn adres,
 * antwoorden komen bij hem binnen, en de klant ziet een mens in plaats van een
 * systeemadres.
 */
export function MailboxPanel({
  connection,
  error,
  connected,
  configured,
}: {
  connection: { emailAddress: string; createdAt: Date } | null;
  error?: string;
  /** Adres dat zojuist gekoppeld is, uit de terugweg van Microsoft. */
  connected?: string;
  /** Of de beheerder de Entra-gegevens al ingevuld heeft. */
  configured: boolean;
}) {
  return (
    <section className="panel p-4 sm:p-6 space-y-4">
      <div>
        <div className="label text-[var(--accent)]">Mailbox</div>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Koppel je Microsoft 365-postvak om vanuit MATO te mailen. Mail vertrekt
          van jouw eigen adres en antwoorden komen bij de juiste lead terecht.
        </p>
      </div>

      {connected && (
        <p className="text-sm text-[var(--ok)]">
          Gekoppeld aan <span className="mono">{connected}</span>.
        </p>
      )}
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}

      {connection ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm">
            <div className="mono">{connection.emailAddress}</div>
            <div className="text-xs text-[var(--text-dim)]">
              gekoppeld op{" "}
              {connection.createdAt.toLocaleDateString("nl-BE", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
          <form action={disconnectMailboxAction} className="ml-auto">
            <button type="submit" className="btn">
              Ontkoppelen
            </button>
          </form>
        </div>
      ) : configured ? (
        // Een gewone link, geen formulier: de route stuurt door naar Microsoft
        // en zet onderweg de cookie met de state.
        <a href="/api/mail/connect" className="btn btn-primary inline-block">
          Mailbox koppelen
        </a>
      ) : (
        <p className="text-sm text-[var(--text-dim)]">
          Vul eerst de Microsoft-gegevens hieronder in; daarna verschijnt hier de
          koppelknop.
        </p>
      )}
    </section>
  );
}
