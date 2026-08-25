import { CADENCES, type CadenceKey } from "@/lib/cadences";
import {
  nextCadenceTask,
  type CadenceTask,
} from "@/lib/cadence-display";

export function CadencePanel({
  cadenceKey,
  tasks,
}: {
  cadenceKey: CadenceKey;
  tasks: CadenceTask[];
}) {
  const next = nextCadenceTask(tasks);
  const label = {
    LEAD_FOLLOWUP: "Leadopvolging",
    CUSTOMER_ONBOARDING: "Klantnazorg",
    INSTALL_HANDOFF: "Installatie",
    SHOP_RENEWAL: "Contractverlenging",
  }[cadenceKey];

  return (
    <section className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="label text-[var(--accent)]">{label}</h2>
          {next ? (
            <>
              <p className="font-medium mt-2">{next.title}</p>
              <p className="text-xs text-[var(--text-dim)] mt-1">
                Stap {next.cadenceStep ?? "?"} van {CADENCES[cadenceKey].length}
                {" · "}
                {next.dueAt
                  ? next.dueAt.toLocaleDateString("nl-BE")
                  : "zonder datum"}
              </p>
            </>
          ) : (
            <p className="text-sm text-[var(--text-dim)] mt-2">
              Geen actieve cadans.
            </p>
          )}
        </div>
        <span className={`badge ${next ? "badge-live" : ""}`}>
          {next ? "Actief" : "Niet actief"}
        </span>
      </div>
    </section>
  );
}
