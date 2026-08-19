import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { groupTasksByDueDate, TASK_SELECT, type DueTask } from "@/lib/tasks";
import { completeTask, cancelTask } from "@/lib/task-actions";

export const dynamic = "force-dynamic";

/**
 * Mijn taken — het volledige overzicht.
 *
 * De strook op Werk en op Klanten toont hetzelfde voor wie snel iets wil
 * afvinken zonder weg te navigeren; dit hier is de plek om vooruit te plannen.
 */
export default async function TakenPage() {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const tasks: DueTask[] = await prisma.task.findMany({
    where: { assignedToId: user.id, status: "OPEN" },
    orderBy: [{ dueAt: "asc" }, { priority: "asc" }],
    select: TASK_SELECT,
  });
  const groups = groupTasksByDueDate(tasks);

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">Taken</p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Mijn taken</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Wat je zelf noteerde, en straks ook wat de opvolgcadans voor je klaarzet.
        </p>
      </div>

      {tasks.length === 0 ? (
        <section className="panel p-6 space-y-3">
          <div className="label text-[var(--accent)]">Niets open</div>
          <p className="text-sm text-[var(--text-dim)] max-w-prose">
            Voeg een taak toe vanaf een lead of een klant — daar staat de context al klaar.
          </p>
        </section>
      ) : (
        <>
          <TaskGroup title="Achterstallig" tasks={groups.overdue} accent="var(--alert)" />
          <TaskGroup title="Vandaag" tasks={groups.today} accent="var(--accent)" />
          <TaskGroup title="Later" tasks={groups.later} accent="var(--text-dim)" />
        </>
      )}
    </div>
  );
}

function TaskGroup({
  title,
  tasks,
  accent,
}: {
  title: string;
  tasks: DueTask[];
  accent: string;
}) {
  if (tasks.length === 0) return null;
  return (
    <section className="panel p-4">
      <h2 className="label mb-3" style={{ color: accent }}>
        {title} · {tasks.length}
      </h2>
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] pb-2 last:border-0"
          >
            <div>
              <div className="text-sm font-medium">{task.title}</div>
              {task.description && (
                <div className="text-sm text-[var(--text-dim)]">{task.description}</div>
              )}
              <div className="text-xs text-[var(--text-dim)] mt-0.5">
                {task.lead && (
                  <Link href={`/leads/${task.lead.id}`} className="hover:text-[var(--accent)]">
                    {task.lead.name}
                  </Link>
                )}
                {task.customer && (
                  <Link href={`/klanten/${task.customer.id}`} className="hover:text-[var(--accent)]">
                    {task.customer.name}
                  </Link>
                )}
                {task.dueAt &&
                  ` · ${task.dueAt.toLocaleDateString("nl-BE", { day: "numeric", month: "short" })}`}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <form action={completeTask}>
                <input type="hidden" name="taskId" value={task.id} />
                <button type="submit" className="btn btn-sm btn-primary">
                  Afgerond
                </button>
              </form>
              <form action={cancelTask}>
                <input type="hidden" name="taskId" value={task.id} />
                <button type="submit" className="btn btn-sm btn-ghost">
                  Annuleren
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
