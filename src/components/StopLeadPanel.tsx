import { LOSS_REASONS } from "@/lib/constants";
import { stopLead } from "@/lib/stop-actions";

export function StopLeadPanel({ leadId }: { leadId: string }) {
  const parkDate = new Date();
  parkDate.setUTCDate(parkDate.getUTCDate() + 90);

  return (
    <details className="panel p-4">
      <summary className="label text-[var(--text-dim)] cursor-pointer">
        Opvolging stoppen of later hernemen
      </summary>
      <form action={stopLead} className="space-y-3 mt-4">
        <input type="hidden" name="leadId" value={leadId} />
        <div>
          <label className="label block mb-1">Reden</label>
          <select name="reason" className="select" required defaultValue="">
            <option value="" disabled>
              Kies een reden…
            </option>
            {LOSS_REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label block mb-1">Wat nu?</label>
          <select name="disposition" className="select" defaultValue="PARK">
            <option value="PARK">Later opnieuw opnemen</option>
            <option value="RELEASE">Vrijgeven aan het team</option>
            <option value="LOST">Definitief afsluiten</option>
          </select>
        </div>
        <div>
          <label className="label block mb-1">
            Opnieuw bekijken op (alleen bij later)
          </label>
          <input
            type="date"
            name="parkedUntil"
            className="input"
            defaultValue={parkDate.toISOString().slice(0, 10)}
          />
        </div>
        <button type="submit" className="btn w-full">
          Keuze bewaren
        </button>
      </form>
    </details>
  );
}
