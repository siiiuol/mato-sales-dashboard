import Link from "next/link";
import { prisma } from "@/lib/db";
import { groupTasksByDueDate, TASK_SELECT, type DueTask } from "@/lib/tasks";
import { completeTask } from "@/lib/task-actions";

/**
 * "Taken vandaag" — het compacte broertje van `/taken`.
 *
 * Alleen Achterstallig en Vandaag: wie Werk of Klanten elke dag opent, wil
 * hier zien wat nú moet gebeuren, niet de volledige planning. Wie wil
 * vooruitkijken gaat naar "Mijn taken" — één klik verder, niet hier dubbel.
 *
 * Server Component met zijn eigen query, zoals `/klanten` en `/leads` ook
 * hun eigen Prisma-aanroep doen — `tasks.ts` levert alleen de gedeelde
 * selectie en de groepeerlogica, zodat deze strook en `/taken` nooit
 * onafhankelijk van elkaar gaan bepalen wat "vandaag" betekent.
 */
export async function TaskStrip({ userId }: { userId: string }) {
  const tasks: DueTask[] = await prisma.task.findMany({
    where: { assignedToId: userId, status: "OPEN" },
    orderBy: [{ dueAt: "asc" }, { priority: "asc" }],
    select: TASK_SELECT,
  });
  const { overdue, today } = groupTasksByDueDate(tasks);
  const urgent = [...overdue, ...today];
  if (urgent.length === 0) return null;

  return (
    <section className="panel p-4">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h2 className="label text-[var(--accent)]">Taken vandaag</h2>
        <Link href="/taken" className="text-xs text-[var(--text-dim)] hover:text-[var(--accent)]">
          Alles bekijken
        </Link>
      </div>
      <ul className="space-y-1.5">
        {urgent.map((task) => (
          <li key={task.id} className="flex items-center justify-between gap-2 text-sm">
            <span>
              {overdue.includes(task) && <span className="badge mr-2">Achterstallig</span>}
              {task.title}
              {(task.lead || task.customer) && (
                <span className="text-[var(--text-dim)]">
                  {" · "}
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
                </span>
              )}
            </span>
            <form action={completeTask}>
              <input type="hidden" name="taskId" value={task.id} />
              <button type="submit" className="btn btn-sm">
                Afgerond
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
